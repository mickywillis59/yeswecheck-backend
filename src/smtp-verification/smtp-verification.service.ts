import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import {
  SmtpVerificationResult,
  SmtpConfig,
  SmtpResponse,
  SmtpStage,
  SmtpSkipReason,
  SmtpError,
  SmtpClassification,
  SmtpReasonCategory,
} from './smtp-verification.types';

@Injectable()
export class SmtpVerificationService {
  private readonly logger = new Logger(SmtpVerificationService.name);
  private readonly config: SmtpConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      enabled: this.configService.get<boolean>('smtp.enabled', false),
      heloHostname: this.configService.get<string>(
        'smtp.heloHostname',
        'mail.yeswecheck.fr',
      ),
      mailFrom: this.configService.get<string>(
        'smtp.mailFrom',
        'noreply@yeswecheck.fr',
      ),
      timeoutMs: this.configService.get<number>('smtp.timeoutMs', 1200),
      failFast: this.configService.get<boolean>('smtp.failFast', true),
      skipDisposable: this.configService.get<boolean>(
        'smtp.skipDisposable',
        true,
      ),
      port: this.configService.get<number>('smtp.port', 25),
    };
  }

  /**
   * Extrait l'enhanced status code (X.Y.Z) d'un message SMTP
   */
  private extractEnhancedCode(message: string): string | null {
    const match = message.match(/\b([245]\.\d+\.\d+)\b/);
    return match ? match[1] : null;
  }

  /**
   * Classifie une réponse RCPT TO basée sur le code et l'enhanced code
   */
  private classifyRcpt(code: number, message: string): SmtpClassification {
    const enhanced = this.extractEnhancedCode(message);

    // PASS : mailbox acceptée
    if (code === 250 || code === 251) {
      return {
        status: 'pass',
        exists: true,
        category: 'OK',
        reason: 'RCPT_ACCEPTED',
        enhanced,
      };
    }

    // FAIL fiable : adresse inexistante (5.1.x)
    if (enhanced?.startsWith('5.1.')) {
      return {
        status: 'fail',
        exists: false,
        category: 'MAILBOX_NOT_FOUND',
        reason: `HARD_BOUNCE_${enhanced}`,
        enhanced,
      };
    }

    // TEMPORAIRE : 4xx ou enhanced 4.x.x
    if ((code >= 400 && code < 500) || enhanced?.startsWith('4.')) {
      return {
        status: 'unknown',
        exists: null,
        category: 'TEMPORARY',
        reason: `TEMPFAIL_${enhanced ?? code}`,
        enhanced,
      };
    }

    // POLICY / SÉCURITÉ : 5.7.x
    if (enhanced?.startsWith('5.7.')) {
      return {
        status: 'unknown',
        exists: null,
        category: 'POLICY',
        reason: `POLICY_${enhanced}`,
        enhanced,
      };
    }

    // SYSTEM : 5.3.x
    if (enhanced?.startsWith('5.3.')) {
      return {
        status: 'unknown',
        exists: null,
        category: 'SYSTEM',
        reason: `SYSTEM_${enhanced}`,
        enhanced,
      };
    }

    // ROUTING : 5.4.x
    if (enhanced?.startsWith('5.4.')) {
      return {
        status: 'unknown',
        exists: null,
        category: 'ROUTING',
        reason: `ROUTING_${enhanced}`,
        enhanced,
      };
    }

    // Fallback patterns (si pas d'enhanced code) - STRICT
    const msg = message.toLowerCase();
    const looksLikeNotFound =
      /(user unknown|unknown user|no such user|mailbox not found|does not exist)/i.test(
        msg,
      );

    if (code === 550 && looksLikeNotFound) {
      return {
        status: 'fail',
        exists: false,
        category: 'MAILBOX_NOT_FOUND',
        reason: 'HARD_BOUNCE_550_FALLBACK',
        enhanced,
      };
    }

    // Tout le reste 5xx = inconclusive (SAFE)
    if (code >= 500) {
      return {
        status: 'unknown',
        exists: null,
        category: 'UNKNOWN',
        reason: `UNKNOWN_5XX_${enhanced ?? code}`,
        enhanced,
      };
    }

    return {
      status: 'unknown',
      exists: null,
      category: 'UNKNOWN',
      reason: 'UNKNOWN',
      enhanced,
    };
  }

  /**
   * Point d'entrée principal pour la vérification SMTP
   */
  async verify(
    email: string,
    mxRecords: Array<{ exchange: string; priority: number }>,
    options?: {
      smtpEnabled?: boolean;
      timeoutOverride?: number;
      isDisposable?: boolean;
    },
  ): Promise<SmtpVerificationResult> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutOverride || this.config.timeoutMs;
    const smtpEnabled = options?.smtpEnabled ?? this.config.enabled;

    if (!smtpEnabled) {
      return this.createSkippedResult(
        timeoutMs,
        'SMTP verification disabled',
        'SMTP_DISABLED',
        'DISABLED',
      );
    }

    if (this.config.skipDisposable && options?.isDisposable) {
      return this.createSkippedResult(
        timeoutMs,
        'Skipped for disposable email',
        'DISPOSABLE',
        'DISPOSABLE',
      );
    }

    if (!mxRecords || mxRecords.length === 0) {
      return {
        enabled: true,
        status: 'unknown',
        exists: null,
        responseCode: null,
        enhancedCode: null,
        reasonCategory: 'NO_MX',
        reasonCode: 'NO_MX_RECORDS',
        stage: null,
        latencyMs: Date.now() - startTime,
        timeoutMs,
        message: 'No MX records available for SMTP verification',
        mxHost: null,
        skipReason: 'NO_MX_RECORDS',
      };
    }

    const sortedMx = [...mxRecords].sort((a, b) => a.priority - b.priority);

    if (this.config.failFast) {
      return await this.verifyWithLightFallback(
        email,
        sortedMx,
        timeoutMs,
        startTime,
      );
    }

    return await this.verifyWithFullFallback(
      email,
      sortedMx,
      timeoutMs,
      startTime,
    );
  }

  /**
   * Vérification avec fallback light (failFast=true)
   */
  private async verifyWithLightFallback(
    email: string,
    mxList: Array<{ exchange: string; priority: number }>,
    timeoutMs: number,
    startTime: number,
  ): Promise<SmtpVerificationResult> {
    const firstResult = await this.verifyOnMx(
      email,
      mxList[0].exchange,
      timeoutMs,
      startTime,
    );

    if (firstResult.status === 'pass' || firstResult.status === 'fail') {
      return firstResult;
    }

    if (mxList.length > 1) {
      const secondResult = await this.verifyOnMx(
        email,
        mxList[1].exchange,
        timeoutMs,
        startTime,
      );

      if (secondResult.status === 'pass' || secondResult.status === 'fail') {
        return secondResult;
      }

      return secondResult;
    }

    return firstResult;
  }

  /**
   * Vérification avec fallback complet (failFast=false)
   */
  private async verifyWithFullFallback(
    email: string,
    mxList: Array<{ exchange: string; priority: number }>,
    timeoutMs: number,
    startTime: number,
  ): Promise<SmtpVerificationResult> {
    let lastResult: SmtpVerificationResult | null = null;

    for (const mx of mxList) {
      const result = await this.verifyOnMx(
        email,
        mx.exchange,
        timeoutMs,
        startTime,
      );

      if (result.status === 'pass' || result.status === 'fail') {
        return result;
      }

      lastResult = result;
    }

    return (
      lastResult || {
        enabled: true,
        status: 'unknown',
        exists: null,
        responseCode: null,
        enhancedCode: null,
        reasonCategory: 'UNKNOWN',
        reasonCode: 'ALL_MX_FAILED',
        stage: null,
        latencyMs: Date.now() - startTime,
        timeoutMs,
        message: 'All MX servers returned inconclusive results',
        mxHost: null,
      }
    );
  }

  /**
   * Vérification SMTP sur un seul serveur MX
   */
  private async verifyOnMx(
    email: string,
    mxHost: string,
    timeoutMs: number,
    startTime: number,
  ): Promise<SmtpVerificationResult> {
    try {
      const result = await this.runSmtpSession(email, mxHost, timeoutMs); 

  // ⚠️ Classification si on sort AVANT RCPT_TO

  if (result.stage !== 'RCPT_TO') {
  const enhanced = this.extractEnhancedCode(result.message);
  const isTemp = result.code >= 400 && result.code < 500;

  let category: SmtpReasonCategory = isTemp ? 'TEMPORARY' : 'SYSTEM';

  if (enhanced?.startsWith('5.7.')) category = 'POLICY';
  else if (enhanced?.startsWith('5.4.')) category = 'ROUTING';
  else if (enhanced?.startsWith('5.3.')) category = 'SYSTEM';
  else if (enhanced?.startsWith('5.1.')) category = 'MAILBOX_NOT_FOUND'; // rare hors RCPT mais safe

  return {
    enabled: true,
    status: 'unknown',
    exists: null,
    responseCode: result.code,
    enhancedCode: enhanced,
    reasonCategory: category,
    reasonCode: `NON_RCPT_STAGE_${result.stage}`,
    stage: result.stage,
    latencyMs: Date.now() - startTime,
    timeoutMs,
    message: result.message,
    mxHost,
  };
}



      // Classification basée sur enhanced codes (uniquement à RCPT_TO)
      const cls = this.classifyRcpt(result.code, result.message);

      return {
        enabled: true,
        status: cls.status,
        exists: cls.exists,
        responseCode: result.code,
        enhancedCode: cls.enhanced,
        reasonCategory: cls.category,
        reasonCode: cls.reason,
        stage: result.stage,
        latencyMs: Date.now() - startTime,
        timeoutMs,
        message: result.message,
        mxHost,
      };
    } catch (error) {
      return this.handleSmtpError(error, mxHost, timeoutMs, startTime);
    }
  }

  /**
   * Session SMTP complète
   */
  private async runSmtpSession(
    email: string,
    mxHost: string,
    timeoutMs: number,
  ): Promise<SmtpResponse> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let currentStage: SmtpStage = 'CONNECT';
      let buffer = '';
      let isResolved = false;
      let isWaitingMultiline = false;

      socket.setTimeout(timeoutMs);

      const timeoutHandler = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          socket.destroy();
          const error = new SmtpError(
            'SMTP session timeout',
            null,
            currentStage,
          );
          (error as any).code = 'ETIMEDOUT';
          reject(error);
        }
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timeoutHandler);
        socket.destroy();
      };

      const resolveResult = (result: SmtpResponse) => {
        if (!isResolved) {
          isResolved = true;
          try {
            socket.write('QUIT\r\n');
          } catch (e) {
            // Ignore
          }
          cleanup();
          resolve(result);
        }
      };

      const rejectError = (error: Error | SmtpError) => {
        if (!isResolved) {
          isResolved = true;
          try {
            socket.write('QUIT\r\n');
          } catch (e) {
            // Ignore
          }
          cleanup();
          reject(error);
        }
      };

      socket.on('error', (err: any) => {
        const smtpError = new SmtpError(
          err.message || 'Socket error',
          null,
          currentStage,
        );
        (smtpError as any).code = err.code;
        rejectError(smtpError);
      });

      socket.on('timeout', () => {
        const error = new SmtpError('Socket timeout', null, currentStage);
        (error as any).code = 'ETIMEDOUT';
        rejectError(error);
      });

      socket.on('data', (data: Buffer) => {
        buffer += data.toString('utf-8');

        const lines = buffer.split('\r\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const result = this.handleSmtpLine(
              line,
              socket,
              email,
              currentStage,
              isWaitingMultiline,
              (newStage) => {
                currentStage = newStage;
              },
              (waiting) => {
                isWaitingMultiline = waiting;
              },
            );

            if (result) {
              resolveResult(result);
              return;
            }
          } catch (err) {
            rejectError(err as Error);
            return;
          }
        }
      });

      socket.connect(this.config.port, mxHost, () => {
        currentStage = 'CONNECT';
      });
    });
  }

  /**
   * Traite une ligne de réponse SMTP
   */
  private handleSmtpLine(
    line: string,
    socket: net.Socket,
    email: string,
    currentStage: SmtpStage,
    isWaitingMultiline: boolean,
    setStage: (stage: SmtpStage) => void,
    setWaitingMultiline: (waiting: boolean) => void,
  ): SmtpResponse | null {
    const code = parseInt(line.substring(0, 3), 10);
    const separator = line[3];
    const message = line.substring(4).trim();
    const isMultiline = separator === '-';

    this.logger.debug(`[${currentStage}] ${code}${separator} ${message}`);

    if (isMultiline) {
      setWaitingMultiline(true);
      return null;
    }

    if (isWaitingMultiline) {
      setWaitingMultiline(false);
    }

    // Gestion des codes temporaires 4xx → unknown
    if (code >= 400 && code < 500) {
      return {
        success: false,
        code,
        message,
        stage: currentStage,
      };
    }

    switch (currentStage) {
      case 'CONNECT':
        if (code === 220) {
          setStage('EHLO');
          socket.write(`EHLO ${this.config.heloHostname}\r\n`);
        } else {
          throw new SmtpError(
            `Unexpected banner: ${code} ${message}`,
            code,
            'CONNECT',
          );
        }
        break;

      case 'EHLO':
        if (code === 250) {
          setStage('MAIL_FROM');
          socket.write(`MAIL FROM:<${this.config.mailFrom}>\r\n`);
        } else if (code === 502 || code === 500) {
          setStage('HELO');
          socket.write(`HELO ${this.config.heloHostname}\r\n`);
        } else {
          throw new SmtpError(`EHLO failed: ${code} ${message}`, code, 'EHLO');
        }
        break;

      case 'HELO':
        if (code === 250) {
          setStage('MAIL_FROM');
          socket.write(`MAIL FROM:<${this.config.mailFrom}>\r\n`);
        } else {
          throw new SmtpError(`HELO failed: ${code} ${message}`, code, 'HELO');
        }
        break;

      case 'MAIL_FROM':
        if (code === 250) {
          setStage('RCPT_TO');
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else {
          throw new SmtpError(
            `MAIL FROM failed: ${code} ${message}`,
            code,
            'MAIL_FROM',
          );
        }
        break;

      case 'RCPT_TO':
        // Retourner la réponse brute pour classification
        return {
          success: code === 250 || code === 251,
          code,
          message,
          stage: 'RCPT_TO',
        };

      case 'QUIT':
        break;

      default:
        throw new SmtpError(
          `Unexpected stage: ${currentStage}`,
          code,
          currentStage,
        );
    }

    return null;
  }

  /**
   * Gestion des erreurs SMTP
   */
  private handleSmtpError(
    error: any,
    mxHost: string,
    timeoutMs: number,
    startTime: number,
  ): SmtpVerificationResult {
    const networkErrors = [
      'ETIMEDOUT',
      'ECONNREFUSED',
      'EHOSTUNREACH',
      'ENOTFOUND',
      'ECONNRESET',
      'ENETUNREACH',
      'EPIPE',
    ];

    const isNetworkError =
      networkErrors.includes(error.code) ||
      error.message?.toLowerCase().includes('timeout');

    const stage: SmtpStage = error.stage || 'CONNECT';
    const responseCode = error.smtpCode ?? null;

    return {
      enabled: true,
      status: 'unknown',
      exists: null,
      responseCode,
      enhancedCode: null,
      reasonCategory: isNetworkError ? 'NETWORK' : 'SYSTEM',
      reasonCode: isNetworkError ? `NETWORK_ERROR_${error.code}` : 'SMTP_ERROR',
      stage,
      latencyMs: Date.now() - startTime,
      timeoutMs,
      message: isNetworkError
        ? `Network error at ${stage}: ${error.code || 'timeout'}`
        : `SMTP error at ${stage}: ${error.message || 'Unknown error'}`,
      mxHost,
    };
  }

  /**
   * Crée un résultat "skipped"
   */
  private createSkippedResult(
    timeoutMs: number,
    message: string,
    skipReason: SmtpSkipReason,
    category: SmtpReasonCategory,
  ): SmtpVerificationResult {
    return {
      enabled: true,
      status: 'skipped',
      exists: null,
      responseCode: null,
      enhancedCode: null,
      reasonCategory: category,
      reasonCode: skipReason,
      stage: null,
      latencyMs: null,
      timeoutMs,
      message,
      mxHost: null,
      skipReason,
    };
  }
}
