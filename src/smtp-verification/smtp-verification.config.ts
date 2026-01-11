import { registerAs } from '@nestjs/config';

export default registerAs('smtp', () => ({
  enabled: process.env.SMTP_VERIFICATION_ENABLED === 'true',
  heloHostname: process.env.SMTP_HELO_HOSTNAME || 'mail.yeswecheck.fr',
  mailFrom: process.env.SMTP_MAIL_FROM || 'noreply@yeswecheck.fr',
  timeoutMs: parseInt(process.env.SMTP_TIMEOUT_MS || '1200', 10),
  failFast: process.env.SMTP_FAIL_FAST !== 'false',
  skipDisposable: process.env.SMTP_SKIP_DISPOSABLE !== 'false',
  port: parseInt(process.env.SMTP_PORT || '25', 10),
}));
