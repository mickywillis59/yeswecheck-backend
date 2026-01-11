import { Injectable } from '@nestjs/common';
import * as dns from 'dns';
import { promisify } from 'util';
import { DisposableEmailService } from '../disposable-email/disposable-email.service';
import { RoleAccountService } from '../role-account/role-account.service';
import { WhitelistService } from '../whitelist/whitelist.service';
import { BlacklistService } from '../blacklist/blacklist.service';
import { ProfanityService } from '../profanity/profanity.service';
import { RandomDetectionService } from '../random-detection/random-detection.service';
import { FirstnameEnrichmentService } from '../firstname-enrichment/firstname-enrichment.service';
import { SmtpVerificationService } from '../smtp-verification/smtp-verification.service';
import { SmtpVerificationResult } from '../smtp-verification/smtp-verification.types';

const resolveMx = promisify(dns.resolveMx);
const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);

type DnsReasonCode =
  | 'MX_FOUND'
  | 'A_FALLBACK'
  | 'NO_MX_NO_A'
  | 'NULL_MX'
  | 'NXDOMAIN'
  | 'SERVFAIL'
  | 'TIMEOUT'
  | 'DNS_ERROR';

type TypoMatchedBy = 'TLD_MATCH' | 'NO_TLD_GUESS' | 'TLD_FALLBACK';

type TypoDomainSuggestion =
  | {
      detected: true;
      inputDomain: string;
      suggestion: string;
      distance: number;
      confidence: number;
      matchedBy: TypoMatchedBy;
      note?: string;
    }
  | {
      detected: false;
    };

type DomainEntry = {
  base: string;
  tld: string;
  popularity: number;
};

type Validity = 'valid' | 'invalid' | 'unknown';

const POPULAR_DOMAINS: DomainEntry[] = [
  { base: 'gmail', tld: '.com', popularity: 100 },
  { base: 'outlook', tld: '.com', popularity: 95 },
  { base: 'outlook', tld: '.fr', popularity: 82 },
  { base: 'hotmail', tld: '.com', popularity: 88 },
  { base: 'hotmail', tld: '.fr', popularity: 80 },
  { base: 'yahoo', tld: '.com', popularity: 85 },
  { base: 'yahoo', tld: '.fr', popularity: 75 },
  { base: 'orange', tld: '.fr', popularity: 92 },
  { base: 'wanadoo', tld: '.fr', popularity: 70 },
  { base: 'free', tld: '.fr', popularity: 88 },
  { base: 'sfr', tld: '.fr', popularity: 85 },
  { base: 'laposte', tld: '.net', popularity: 80 },
  { base: 'icloud', tld: '.com', popularity: 82 },
  { base: 'me', tld: '.com', popularity: 65 },
  { base: 'mac', tld: '.com', popularity: 60 },
  { base: 'live', tld: '.com', popularity: 78 },
  { base: 'live', tld: '.fr', popularity: 72 },
  { base: 'msn', tld: '.com', popularity: 70 },
  { base: 'protonmail', tld: '.com', popularity: 75 },
  { base: 'proton', tld: '.me', popularity: 70 },
  { base: 'aol', tld: '.com', popularity: 65 },
  { base: 'gmx', tld: '.fr', popularity: 68 },
  { base: 'gmx', tld: '.de', popularity: 70 },
  { base: 'gmx', tld: '.com', popularity: 65 },
  { base: 'bbox', tld: '.fr', popularity: 75 },
  { base: 'club-internet', tld: '.fr', popularity: 60 },
  { base: 'neuf', tld: '.fr', popularity: 62 },
  { base: 'numericable', tld: '.fr', popularity: 58 },
  { base: 'aliceadsl', tld: '.fr', popularity: 55 },
  { base: 'voila', tld: '.fr', popularity: 60 },
  { base: 'caramail', tld: '.com', popularity: 50 },
  { base: 'mail', tld: '.com', popularity: 60 },
  { base: 'yandex', tld: '.ru', popularity: 65 },
  { base: 'yandex', tld: '.com', popularity: 58 },
  { base: 'zoho', tld: '.com', popularity: 62 },
  { base: 'qq', tld: '.com', popularity: 55 },
  { base: 'naver', tld: '.com', popularity: 52 },
  { base: 'daum', tld: '.net', popularity: 50 },
  { base: 'comcast', tld: '.net', popularity: 58 },
  { base: 'verizon', tld: '.net', popularity: 55 },
  { base: 'att', tld: '.net', popularity: 54 },
  { base: 'btinternet', tld: '.com', popularity: 52 },
  { base: 'mail', tld: '.ru', popularity: 50 },
  { base: 'inbox', tld: '.com', popularity: 48 },
  { base: 'fastmail', tld: '.com', popularity: 56 },
  { base: 'tutanota', tld: '.com', popularity: 54 },
  { base: 'hushmail', tld: '.com', popularity: 50 },
];

@Injectable()
export class ValidationService {
  constructor(
    private readonly disposableEmailService: DisposableEmailService,
    private readonly roleAccountService: RoleAccountService,
    private readonly whitelistService: WhitelistService,
    private readonly blacklistService: BlacklistService,
    private readonly profanityService: ProfanityService,
    private readonly randomDetectionService: RandomDetectionService,
    private readonly firstnameEnrichmentService: FirstnameEnrichmentService,
    private readonly smtpService: SmtpVerificationService,
  ) {}

  // =========================
  // TYPO DOMAIN (Suggestion)
  // =========================

  private normalizeEmailForTypo(email: string): string {
    return String(email || '')
      .trim()
      .toLowerCase();
  }

  private extractDomainLoosely(email: string): string | null {
    const e = this.normalizeEmailForTypo(email);
    const at = e.lastIndexOf('@');
    if (at === -1) return null;
    const rawDomain = e.slice(at + 1).trim();
    if (!rawDomain) return null;
    return rawDomain.replace(/\.$/, '');
  }

  private splitBaseAndTld(domain: string): {
    base: string;
    tld: string | null;
  } {
    const d = String(domain || '')
      .trim()
      .toLowerCase()
      .replace(/\.$/, '');

    if (!d) return { base: '', tld: null };
    if (!d.includes('.')) return { base: d, tld: null };

    const lastDot = d.lastIndexOf('.');
    const base = d.slice(0, lastDot).trim();
    const tld = d.slice(lastDot).trim();

    return { base, tld };
  }

  private maxDistanceFor(base: string): number {
    const len = base.length;
    if (len <= 5) return 1;
    if (len <= 10) return 2;
    return 3;
  }

  private damerauLevenshtein(a: string, b: string, maxDist: number): number {
    if (a === b) return 0;
    const alen = a.length;
    const blen = b.length;

    if (Math.abs(alen - blen) > maxDist) return maxDist + 1;
    if (alen === 0) return blen;
    if (blen === 0) return alen;

    const dp: number[][] = Array.from({ length: alen + 1 }, () =>
      new Array(blen + 1).fill(0),
    );

    for (let i = 0; i <= alen; i++) dp[i][0] = i;
    for (let j = 0; j <= blen; j++) dp[0][j] = j;

    for (let i = 1; i <= alen; i++) {
      let rowMin = Number.POSITIVE_INFINITY;

      for (let j = 1; j <= blen; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;

        let v = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost,
        );

        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          v = Math.min(v, dp[i - 2][j - 2] + 1);
        }

        dp[i][j] = v;
        if (v < rowMin) rowMin = v;
      }

      if (rowMin > maxDist) return maxDist + 1;
    }

    return dp[alen][blen];
  }

  private suggestTypoDomain(email: string): TypoDomainSuggestion {
    const domainRaw = this.extractDomainLoosely(email);
    if (!domainRaw) return { detected: false };

    const dotCount = (domainRaw.match(/\./g) || []).length;
    if (dotCount >= 2) return { detected: false };

    const { base: inputBase0, tld: inputTld } = this.splitBaseAndTld(domainRaw);
    const inputBase = (inputBase0 || '').replace(/\s+/g, '');
    if (!inputBase) return { detected: false };

    const maxDist = this.maxDistanceFor(inputBase);

    let candidates: DomainEntry[] = [];
    let matchedBy: TypoMatchedBy = 'NO_TLD_GUESS';

    if (inputTld) {
      const tldNorm = inputTld.toLowerCase();
      candidates = POPULAR_DOMAINS.filter(
        (d) => d.tld.toLowerCase() === tldNorm,
      );
      matchedBy = 'TLD_MATCH';

      if (candidates.length === 0) {
        candidates = POPULAR_DOMAINS;
        matchedBy = 'TLD_FALLBACK';
      }
    } else {
      candidates = POPULAR_DOMAINS;
      matchedBy = 'NO_TLD_GUESS';
    }

    const scored: Array<{
      domain: DomainEntry;
      distance: number;
    }> = [];

    for (const domain of candidates) {
      const dist = this.damerauLevenshtein(inputBase, domain.base, maxDist);
      if (dist <= maxDist) {
        scored.push({ domain, distance: dist });
      }
    }

    if (scored.length === 0) return { detected: false };

    scored.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return b.domain.popularity - a.domain.popularity;
    });

    const best = scored[0];
    const second = scored[1];

    if (
      second &&
      second.distance === best.distance &&
      second.domain.popularity === best.domain.popularity
    ) {
      return { detected: false };
    }

    const fullDomain = `${best.domain.base}${best.domain.tld}`;
    if (domainRaw.toLowerCase() === fullDomain.toLowerCase()) {
      return { detected: false };
    }

    const maxLen = Math.max(inputBase.length, best.domain.base.length);
    let confidence = 1 - best.distance / maxLen;

    if (inputTld && inputTld.toLowerCase() === best.domain.tld.toLowerCase()) {
      confidence += 0.1;
    }

    confidence = Math.min(1, Math.max(0, confidence));
    confidence = Number(confidence.toFixed(2));

    if (confidence < 0.75) return { detected: false };

    return {
      detected: true,
      inputDomain: domainRaw,
      suggestion: fullDomain,
      distance: best.distance,
      confidence,
      matchedBy,
      note:
        matchedBy === 'NO_TLD_GUESS'
          ? 'No TLD provided, guessed best domain'
          : undefined,
    };
  }

  // =========================
  // SYNTAX
  // =========================

  validateSyntax(email: string): {
    isValid: boolean;
    message: string;
    score: number;
  } {
    if (!email || email.trim() === '') {
      return { isValid: false, message: 'Email cannot be empty', score: 0 };
    }

    if (/\s/.test(email)) {
      return {
        isValid: false,
        message: 'Email cannot contain spaces',
        score: 10,
      };
    }

    if (/[\u0000-\u001F\u007F]/.test(email)) {
      return {
        isValid: false,
        message: 'Email contains invalid control characters',
        score: 10,
      };
    }

    if (email.length > 254) {
      return {
        isValid: false,
        message: 'Email is too long (max 254 characters)',
        score: 10,
      };
    }

    const atCount = (email.match(/@/g) || []).length;
    if (atCount !== 1) {
      return {
        isValid: false,
        message: 'Email must contain a single @',
        score: 20,
      };
    }

    const [local, domain] = email.split('@');

    if (!local)
      return { isValid: false, message: 'Missing local part', score: 20 };
    if (local.length > 64)
      return {
        isValid: false,
        message: 'Local part is too long (max 64)',
        score: 10,
      };

    if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
      return {
        isValid: false,
        message: 'Local part has invalid dot placement',
        score: 20,
      };
    }

    if (!/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) {
      return {
        isValid: false,
        message: 'Local part contains invalid characters',
        score: 20,
      };
    }

    if (!domain)
      return { isValid: false, message: 'Missing domain', score: 20 };
    if (domain.length > 253)
      return { isValid: false, message: 'Domain is too long', score: 10 };

    if (
      domain.startsWith('.') ||
      domain.endsWith('.') ||
      domain.includes('..')
    ) {
      return {
        isValid: false,
        message: 'Domain has invalid dot placement',
        score: 20,
      };
    }

    if (!domain.includes('.')) {
      return {
        isValid: false,
        message: 'Domain must contain a dot',
        score: 20,
      };
    }

    const labels = domain.split('.');
    for (const label of labels) {
      if (!label.length) {
        return {
          isValid: false,
          message: 'Domain contains empty label',
          score: 20,
        };
      }
      if (label.length > 63) {
        return {
          isValid: false,
          message: 'Domain label is too long (max 63)',
          score: 10,
        };
      }
      if (!/^[A-Za-z0-9-]+$/.test(label)) {
        return {
          isValid: false,
          message: 'Domain contains invalid characters',
          score: 20,
        };
      }
      if (label.startsWith('-') || label.endsWith('-')) {
        return {
          isValid: false,
          message: 'Domain label has invalid hyphen placement',
          score: 20,
        };
      }
    }

    const tld = labels[labels.length - 1];
    if (tld.length < 2) {
      return {
        isValid: false,
        message: 'Top-level domain is too short',
        score: 20,
      };
    }

    return { isValid: true, message: 'Email syntax is valid', score: 100 };
  }

  // =========================
  // DNS
  // =========================

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () =>
            reject(
              Object.assign(new Error('DNS_TIMEOUT'), { code: 'DNS_TIMEOUT' }),
            ),
          ms,
        ),
      ),
    ]);
  }

  private normalizeDomainFromEmail(email: string): string | null {
    if (!email) return null;
    const raw = String(email).trim();
    if (!raw.includes('@')) return null;

    const parts = raw.split('@');
    const domainRaw = parts[parts.length - 1]?.trim();
    if (!domainRaw) return null;

    const domain = domainRaw.toLowerCase().replace(/\.$/, '');
    if (!domain) return null;

    return domain;
  }

  async validateDNS(email: string): Promise<{
    isValid: boolean;
    message: string;
    score: number;
    reasonCode: DnsReasonCode;
    dnsTimeout?: boolean;
    isNullMX?: boolean;
    hasA?: boolean;
    hasAAAA?: boolean;
    mxRecords?: { exchange: string; priority: number }[];
  }> {
    const domain = this.normalizeDomainFromEmail(email);

    if (!domain) {
      return {
        isValid: false,
        message: 'Invalid email format (no domain)',
        score: 0,
        reasonCode: 'DNS_ERROR',
      };
    }

    const TIMEOUT_MS = 1500;

    try {
      const mxRaw: any[] = await this.withTimeout(
        resolveMx(domain) as Promise<any[]>,
        TIMEOUT_MS,
      );

      const mxRecords = (mxRaw || [])
        .map((r) => ({
          exchange: String(r.exchange || '').trim(),
          priority: r.priority,
        }))
        .filter((r) => r.exchange.length > 0);

      const isNullMX = mxRecords.some((r) => r.exchange === '.');

      if (isNullMX) {
        return {
          isValid: false,
          message:
            "Ce domaine indique explicitement qu'il ne reçoit pas d'emails (Null MX).",
          score: 10,
          reasonCode: 'NULL_MX',
          isNullMX: true,
          mxRecords,
        };
      }

      if (mxRecords.length > 0) {
        return {
          isValid: true,
          message: `Domain ${domain} has valid MX records`,
          score: 100,
          reasonCode: 'MX_FOUND',
          isNullMX: false,
          mxRecords,
        };
      }
    } catch (err) {
      // Continue to fallback
    }

    const [aRes, aaaaRes] = await Promise.allSettled([
      this.withTimeout(resolve4(domain) as Promise<any>, TIMEOUT_MS),
      this.withTimeout(resolve6(domain) as Promise<any>, TIMEOUT_MS),
    ]);

    const hasA =
      aRes.status === 'fulfilled' &&
      Array.isArray(aRes.value) &&
      aRes.value.length > 0;
    const hasAAAA =
      aaaaRes.status === 'fulfilled' &&
      Array.isArray(aaaaRes.value) &&
      aaaaRes.value.length > 0;

    const aTimedOut =
      aRes.status === 'rejected' && String(aRes.reason?.code) === 'DNS_TIMEOUT';
    const aaaaTimedOut =
      aaaaRes.status === 'rejected' &&
      String(aaaaRes.reason?.code) === 'DNS_TIMEOUT';

    if (aTimedOut || aaaaTimedOut) {
      return {
        isValid: true,
        message:
          'Le DNS a mis trop de temps à répondre (timeout). On considère le domaine OK par prudence.',
        score: 50,
        reasonCode: 'TIMEOUT',
        dnsTimeout: true,
        hasA,
        hasAAAA,
      };
    }

    if (hasA || hasAAAA) {
      return {
        isValid: true,
        message: `Domain ${domain} has no MX records, but has A/AAAA fallback`,
        score: 80,
        reasonCode: 'A_FALLBACK',
        hasA,
        hasAAAA,
      };
    }

    return {
      isValid: false,
      message: `Domain ${domain} has no MX records and no A/AAAA fallback`,
      score: 30,
      reasonCode: 'NO_MX_NO_A',
      hasA,
      hasAAAA,
    };
  }

  private getDnsMultiplier(
    dnsReasonCode: DnsReasonCode,
    dnsTimeout?: boolean,
  ): number {
    if (dnsTimeout || dnsReasonCode === 'TIMEOUT') return 0.85;
    if (dnsReasonCode === 'A_FALLBACK') return 0.92;
    return 1.0;
  }

  // =========================
  // VALIDITY CALCULATION
  // =========================

  private calculateValidity(
    syntaxValid: boolean,
    dnsValid: boolean,
    smtpResult: SmtpVerificationResult | null,
  ): { validity: Validity; isValid: boolean | null } {
    if (!syntaxValid) {
      return { validity: 'invalid', isValid: false };
    }

    if (!dnsValid) {
      return { validity: 'invalid', isValid: false };
    }

    // Pas de SMTP ou skipped → valid (delivery technique OK)
    if (!smtpResult || smtpResult.status === 'skipped') {
      return { validity: 'valid', isValid: true };
    }

    if (smtpResult.status === 'pass') {
      return { validity: 'valid', isValid: true };
    }

    // Branch explicite pour fail
    if (smtpResult.status === 'fail') {
      // MAILBOX_NOT_FOUND → invalid
      if (smtpResult.reasonCategory === 'MAILBOX_NOT_FOUND') {
        return { validity: 'invalid', isValid: false };
      }
      // Autres fail (edge cases, bugs de classification) → unknown (safe)
      return { validity: 'unknown', isValid: null };
    }

    // SMTP unknown
    if (smtpResult.status === 'unknown') {
      return { validity: 'unknown', isValid: null };
    }

    // Fallback safe
    return { validity: 'unknown', isValid: null };
  }

  // =========================
  // VALIDATION COMPLÈTE
  // =========================

  async validateEmail(
    email: string,
    options?: {
      smtp?: boolean;
      smtpTimeout?: number;
    },
  ): Promise<any> {
    const startTime = Date.now();

    const firstnameEnrichment =
      await this.firstnameEnrichmentService.enrich(email);

    const typoDomain = this.suggestTypoDomain(email);

    const syntaxResult = this.validateSyntax(email);

    if (!syntaxResult.isValid) {
      return {
        email,
        isValid: false,
        validity: 'invalid',
        score: syntaxResult.score,
        reason: syntaxResult.message,
        executionTime: `${Date.now() - startTime}ms`,
        risk: {
          profanity: 'none',
          overall: 'high',
        },
        enrichment: {
          firstName: firstnameEnrichment.firstName,
          civility: firstnameEnrichment.civility,
          presumedAge: firstnameEnrichment.presumedAge,
          presumedAgeRange: firstnameEnrichment.presumedAgeRange,
          firstNameConfidence: firstnameEnrichment.firstNameConfidence,
          genderConfidence: firstnameEnrichment.genderConfidence,
          presumedAgeConfidence: firstnameEnrichment.presumedAgeConfidence,
        },
        details: {
          syntax: syntaxResult,
          typoDomain,
        },
      };
    }

    const whitelistCheck = await this.whitelistService.isWhitelisted(email);

    if (whitelistCheck) {
      return {
        email,
        isValid: true,
        validity: 'valid',
        score: 100,
        reason: 'Email is whitelisted (trusted)',
        executionTime: `${Date.now() - startTime}ms`,
        risk: {
          profanity: 'none',
          overall: 'none',
        },
        enrichment: {
          firstName: firstnameEnrichment.firstName,
          civility: firstnameEnrichment.civility,
          presumedAge: firstnameEnrichment.presumedAge,
          presumedAgeRange: firstnameEnrichment.presumedAgeRange,
          firstNameConfidence: firstnameEnrichment.firstNameConfidence,
          genderConfidence: firstnameEnrichment.genderConfidence,
          presumedAgeConfidence: firstnameEnrichment.presumedAgeConfidence,
        },
        details: {
          syntax: syntaxResult,
          typoDomain,
          whitelist: {
            isWhitelisted: true,
            message:
              'This email or domain is in your whitelist and bypasses all validation checks',
          },
        },
      };
    }

    const blacklistCheck = await this.blacklistService.isBlacklisted(email);

    if (blacklistCheck) {
      return {
        email,
        isValid: false,
        validity: 'invalid',
        score: 0,
        reason: 'Email is blacklisted',
        executionTime: `${Date.now() - startTime}ms`,
        risk: {
          profanity: 'none',
          overall: 'high',
        },
        enrichment: {
          firstName: firstnameEnrichment.firstName,
          civility: firstnameEnrichment.civility,
          presumedAge: firstnameEnrichment.presumedAge,
          presumedAgeRange: firstnameEnrichment.presumedAgeRange,
          firstNameConfidence: firstnameEnrichment.firstNameConfidence,
          genderConfidence: firstnameEnrichment.genderConfidence,
          presumedAgeConfidence: firstnameEnrichment.presumedAgeConfidence,
        },
        details: {
          syntax: syntaxResult,
          typoDomain,
          whitelist: { isWhitelisted: false },
          blacklist: {
            isBlacklisted: true,
            message:
              'This email or domain is in your blacklist and has been blocked',
          },
        },
      };
    }

    const dnsResult = await this.validateDNS(email);

    if (!dnsResult.isValid) {
      return {
        email,
        isValid: false,
        validity: 'invalid',
        score: dnsResult.score,
        reason: dnsResult.message,
        executionTime: `${Date.now() - startTime}ms`,
        risk: {
          profanity: 'none',
          overall: 'high',
        },
        enrichment: {
          firstName: firstnameEnrichment.firstName,
          civility: firstnameEnrichment.civility,
          presumedAge: firstnameEnrichment.presumedAge,
          presumedAgeRange: firstnameEnrichment.presumedAgeRange,
          firstNameConfidence: firstnameEnrichment.firstNameConfidence,
          genderConfidence: firstnameEnrichment.genderConfidence,
          presumedAgeConfidence: firstnameEnrichment.presumedAgeConfidence,
        },
        details: {
          syntax: syntaxResult,
          typoDomain,
          whitelist: { isWhitelisted: false },
          blacklist: { isBlacklisted: false },
          dns: dnsResult,
        },
      };
    }

    const profanityCheck = await this.profanityService.checkProfanity(email);
    const disposableCheck =
      await this.disposableEmailService.isDisposable(email);
    const roleCheck = await this.roleAccountService.isRoleAccount(email);
    const randomCheck = await this.randomDetectionService.checkEmail(email);

    // SMTP Verification
    let smtpCheck: SmtpVerificationResult | null = null;

    if (options?.smtp) {
      if (
        dnsResult.reasonCode === 'MX_FOUND' &&
        dnsResult.mxRecords &&
        dnsResult.mxRecords.length > 0
      ) {
        // Cas normal : MX trouvés, on lance SMTP
        smtpCheck = await this.smtpService.verify(email, dnsResult.mxRecords, {
          smtpEnabled: true,
          timeoutOverride: options.smtpTimeout,
          isDisposable: disposableCheck.isDisposable,
        });
      } else if (dnsResult.reasonCode === 'TIMEOUT') {
        // Cas DNS timeout → SMTP skipped avec raison claire
        smtpCheck = {
          enabled: true,
          status: 'skipped',
          exists: null,
          responseCode: null,
          enhancedCode: null,
          reasonCategory: 'NETWORK',
          reasonCode: 'DNS_TIMEOUT',
          stage: null,
          latencyMs: null,
          timeoutMs: options.smtpTimeout ?? 1200,
          message: 'SMTP skipped: DNS timeout, cannot determine MX records',
          mxHost: null,
          skipReason: 'NOT_ELIGIBLE',
        };
      } else {
        // Cas pas de MX (A_FALLBACK, NO_MX_NO_A, NULL_MX)
        smtpCheck = {
          enabled: true,
          status: 'skipped',
          exists: null,
          responseCode: null,
          enhancedCode: null,
          reasonCategory: 'NO_MX',
          reasonCode: 'NO_MX_RECORDS',
          stage: null,
          latencyMs: null,
          timeoutMs: options.smtpTimeout ?? 1200,
          message: 'SMTP skipped: no MX records available for verification',
          mxHost: null,
          skipReason: 'NO_MX_RECORDS',
        };
      }
    }

    const { validity, isValid: validityIsValid } = this.calculateValidity(
      syntaxResult.isValid,
      dnsResult.isValid,
      smtpCheck,
    );

    let finalScore = 100;

    let profanityPenalty = 0;
    let profanityRisk = 'none';

    if (profanityCheck.hasProfanity) {
      if (profanityCheck.severity === 'high') {
        profanityPenalty = 40;
        profanityRisk = 'high';
      } else if (profanityCheck.severity === 'medium') {
        profanityPenalty = 25;
        profanityRisk = 'medium';
      } else if (profanityCheck.severity === 'low') {
        profanityPenalty = 10;
        profanityRisk = 'low';
      }
      finalScore -= profanityPenalty;
    }

    if (disposableCheck.isDisposable) {
      finalScore -= 30;
    }

    if (roleCheck.isRole) {
      finalScore -= 15;
    }

    if (randomCheck.isRandom) {
      if (randomCheck.score >= 80) {
        finalScore -= 25;
      } else if (randomCheck.score >= 60) {
        finalScore -= 15;
      } else {
        finalScore -= 5;
      }
    }

    // Pénalité SMTP uniquement si status=unknown (pas skipped)
    if (smtpCheck && smtpCheck.status === 'unknown') {
      if (smtpCheck.reasonCategory === 'TEMPORARY') {
        finalScore -= 20;
      } else if (smtpCheck.reasonCategory === 'POLICY') {
        finalScore -= 15;
      } else if (smtpCheck.reasonCategory === 'NETWORK') {
        finalScore -= 25;
      } else {
        finalScore -= 30;
      }
    }

    finalScore = Math.max(0, finalScore);

    const dnsMultiplier = this.getDnsMultiplier(
      dnsResult.reasonCode,
      dnsResult.dnsTimeout,
    );
    finalScore = Math.max(0, Math.round(finalScore * dnsMultiplier));

    // MAILBOX_NOT_FOUND → score plafonné à 10
    if (
      smtpCheck &&
      smtpCheck.status === 'fail' &&
      smtpCheck.reasonCategory === 'MAILBOX_NOT_FOUND'
    ) {
      finalScore = Math.min(finalScore, 10);
    }

    const overallRisk = this.calculateOverallRisk(
      finalScore,
      profanityRisk,
      disposableCheck.isDisposable,
      roleCheck.isRole,
      randomCheck.isRandom,
    );

    return {
      email,
      isValid: validityIsValid,
      validity,
      score: finalScore,
      reason: this.buildReasonMessage(
        profanityCheck.hasProfanity,
        disposableCheck.isDisposable,
        roleCheck.isRole,
        randomCheck.isRandom,
        smtpCheck,
      ),
      executionTime: `${Date.now() - startTime}ms`,
      risk: {
        profanity: profanityRisk,
        overall: overallRisk,
      },
      enrichment: {
        firstName: firstnameEnrichment.firstName,
        civility: firstnameEnrichment.civility,
        presumedAge: firstnameEnrichment.presumedAge,
        presumedAgeRange: firstnameEnrichment.presumedAgeRange,
        firstNameConfidence: firstnameEnrichment.firstNameConfidence,
        genderConfidence: firstnameEnrichment.genderConfidence,
        presumedAgeConfidence: firstnameEnrichment.presumedAgeConfidence,
      },
      details: {
        syntax: syntaxResult,
        typoDomain,
        dns: {
          ...dnsResult,
          dnsMultiplier,
        },
        whitelist: { isWhitelisted: false },
        blacklist: { isBlacklisted: false },
        profanity: {
          ...profanityCheck,
          risk: profanityRisk,
          penalty: profanityPenalty,
          message: profanityCheck.hasProfanity
            ? '⚠️ This email contains potentially inappropriate language. Could be legitimate (real name) or intentional.'
            : 'No inappropriate language detected',
        },
        disposable: {
          ...disposableCheck,
          message: disposableCheck.isDisposable
            ? '⚠️ This domain is identified as a temporary/disposable email provider'
            : 'Not a disposable email domain',
        },
        roleAccount: {
          ...roleCheck,
          message: roleCheck.isRole
            ? '⚠️ This email uses a generic role-based address (e.g., info@, contact@, admin@)'
            : 'Not a role-based account',
        },
        randomDetection: {
          ...randomCheck,
          message: randomCheck.isRandom
            ? '⚠️ Email local part appears to contain random/generated characters'
            : 'Email local part appears normal',
        },
        ...(smtpCheck && { smtp: smtpCheck }),
      },
    };
  }

  private buildReasonMessage(
    hasProfanity: boolean,
    isDisposable: boolean,
    isRole: boolean,
    isRandom: boolean,
    smtpCheck: SmtpVerificationResult | null,
  ): string {
    const flags: string[] = [];

    if (hasProfanity) flags.push('profanity detected');
    if (isDisposable) flags.push('disposable domain');
    if (isRole) flags.push('role account');
    if (isRandom) flags.push('random characters detected');

    if (smtpCheck) {
      if (smtpCheck.status === 'fail') {
        flags.push('mailbox not found (SMTP)');
      } else if (smtpCheck.status === 'unknown') {
        flags.push(`SMTP inconclusive (${smtpCheck.reasonCategory})`);
      }
    }

    if (flags.length === 0) {
      return 'Email is valid with high quality';
    }

    return `Email validation completed with notes: ${flags.join(', ')}`;
  }

  private calculateOverallRisk(
    score: number,
    profanityRisk: string,
    isDisposable: boolean,
    isRole: boolean,
    isRandom: boolean,
  ): string {
    if (score < 40 || profanityRisk === 'high') {
      return 'high';
    }

    if (score < 70 || profanityRisk === 'medium' || isDisposable || isRandom) {
      return 'medium';
    }

    if (score < 85 || profanityRisk === 'low' || isRole) {
      return 'low';
    }

    return 'none';
  }
}
