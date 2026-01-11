export type SmtpStatus = 'pass' | 'fail' | 'unknown' | 'skipped';

export type SmtpStage =
  | 'CONNECT'
  | 'EHLO'
  | 'HELO'
  | 'MAIL_FROM'
  | 'RCPT_TO'
  | 'QUIT';

export type SmtpSkipReason =
  | 'SMTP_DISABLED'
  | 'DISPOSABLE'
  | 'NO_MX_RECORDS'
  | 'NOT_ELIGIBLE';

export type SmtpReasonCategory =
  | 'OK'
  | 'MAILBOX_NOT_FOUND'
  | 'TEMPORARY'
  | 'POLICY'
  | 'SYSTEM'
  | 'ROUTING'
  | 'NETWORK'
  | 'NO_MX'
  | 'DISPOSABLE'
  | 'DISABLED'
  | 'UNKNOWN';

export interface SmtpVerificationResult {
  enabled: boolean;
  status: SmtpStatus;
  exists: boolean | null;
  responseCode: number | null;
  enhancedCode: string | null;
  reasonCategory: SmtpReasonCategory;
  reasonCode: string | null;
  stage: SmtpStage | null;
  latencyMs: number | null;
  timeoutMs: number;
  message: string;
  mxHost: string | null;
  skipReason?: SmtpSkipReason;
}

export interface SmtpConfig {
  enabled: boolean;
  heloHostname: string;
  mailFrom: string;
  timeoutMs: number;
  failFast: boolean;
  skipDisposable: boolean;
  port: number;
}

export interface SmtpResponse {
  success: boolean; // Indicatif seulement, re-classifié après
  code: number;
  message: string;
  stage: SmtpStage;
}

export class SmtpError extends Error {
  constructor(
    message: string,
    public smtpCode: number | null,
    public stage: SmtpStage,
  ) {
    super(message);
    this.name = 'SmtpError';
  }
}

export interface SmtpClassification {
  status: 'pass' | 'fail' | 'unknown';
  exists: boolean | null;
  category: SmtpReasonCategory;
  reason: string;
  enhanced: string | null;
}
