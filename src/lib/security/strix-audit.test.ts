import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { isSafeUrl, isPrivateOrBlockedIP } from '@/lib/security/ssrf-guard';
import { 
  roleRank, 
  hasMinRole, 
  canManageRoles, 
  canManageMembers, 
  canEditBackendSettings, 
  canEditClinicalConfig, 
  canSendMessages, 
  canDeleteAccount, 
  normalizeRole 
} from '@/lib/auth/roles';
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature';
import crypto from 'node:crypto';

describe('Strix Security Audit Suite - SSRF Prevention', () => {
  it('blocks private IPv4 addresses', () => {
    expect(isPrivateOrBlockedIP('127.0.0.1')).toBe(true);
    expect(isPrivateOrBlockedIP('10.0.0.1')).toBe(true);
    expect(isPrivateOrBlockedIP('172.16.5.1')).toBe(true);
    expect(isPrivateOrBlockedIP('172.31.255.254')).toBe(true);
    expect(isPrivateOrBlockedIP('192.168.1.1')).toBe(true);
    expect(isPrivateOrBlockedIP('169.254.169.254')).toBe(true); // AWS/GCP/Azure metadata
    expect(isPrivateOrBlockedIP('0.0.0.0')).toBe(true);
  });

  it('permits public IPv4 addresses', () => {
    expect(isPrivateOrBlockedIP('8.8.8.8')).toBe(false);
    expect(isPrivateOrBlockedIP('1.1.1.1')).toBe(false);
    expect(isPrivateOrBlockedIP('104.244.42.1')).toBe(false);
  });

  it('blocks malicious SSRF URL targets', () => {
    expect(isSafeUrl('http://127.0.0.1:3000/api/secret').safe).toBe(false);
    expect(isSafeUrl('http://localhost:8080/admin').safe).toBe(false);
    expect(isSafeUrl('http://169.254.169.254/latest/meta-data/').safe).toBe(false);
    expect(isSafeUrl('http://metadata.google.internal/computeMetadata/v1/').safe).toBe(false);
    expect(isSafeUrl('file:///etc/passwd').safe).toBe(false);
    expect(isSafeUrl('gopher://127.0.0.1:6379/_').safe).toBe(false);
    expect(isSafeUrl('http://192.168.1.100/router').safe).toBe(false);
    expect(isSafeUrl('http://internal.corp.local/api').safe).toBe(false);
  });

  it('allows verified public web URLs', () => {
    expect(isSafeUrl('https://example.com').safe).toBe(true);
    expect(isSafeUrl('https://www.google.com/search?q=clinic').safe).toBe(true);
    expect(isSafeUrl('https://lafleurwellness.com/services').safe).toBe(true);
  });
});

describe('Strix Security Audit Suite - RBAC & Privilege Control', () => {
  it('strictly enforces Admin as the role allowed to change member roles', () => {
    expect(canManageRoles('super_admin')).toBe(true);
    expect(canManageRoles('owner')).toBe(true);
    expect(canManageRoles('admin')).toBe(true);
    expect(canManageRoles('doctor')).toBe(false);
    expect(canManageRoles('manager')).toBe(false);
    expect(canManageRoles('staff')).toBe(false);
  });

  it('allows Admin to manage team members and edit backend settings', () => {
    expect(canManageMembers('super_admin')).toBe(true);
    expect(canManageMembers('admin')).toBe(true);
    expect(canManageMembers('doctor')).toBe(false);
    expect(canManageMembers('manager')).toBe(false);
    expect(canManageMembers('staff')).toBe(false);

    expect(canEditBackendSettings('super_admin')).toBe(true);
    expect(canEditBackendSettings('admin')).toBe(true);
    expect(canEditBackendSettings('doctor')).toBe(false);
    expect(canEditBackendSettings('manager')).toBe(false);
    expect(canEditBackendSettings('staff')).toBe(false);
  });

  it('allows Doctor and Manager to edit clinical configuration', () => {
    expect(canEditClinicalConfig('super_admin')).toBe(true);
    expect(canEditClinicalConfig('admin')).toBe(true);
    expect(canEditClinicalConfig('doctor')).toBe(true);
    expect(canEditClinicalConfig('manager')).toBe(true);
    expect(canEditClinicalConfig('staff')).toBe(false);
  });

  it('allows frontline staff to send patient messages and book appointments', () => {
    expect(canSendMessages('staff')).toBe(true);
    expect(canSendMessages('manager')).toBe(true);
    expect(canSendMessages('doctor')).toBe(true);
    expect(canSendMessages('admin')).toBe(true);
  });

  it('restricts destructive account deletion to Admin only', () => {
    expect(canDeleteAccount('super_admin')).toBe(true);
    expect(canDeleteAccount('owner')).toBe(true);
    expect(canDeleteAccount('admin')).toBe(true);
    expect(canDeleteAccount('doctor')).toBe(false);
    expect(canDeleteAccount('manager')).toBe(false);
    expect(canDeleteAccount('staff')).toBe(false);
  });

  it('validates role rank hierarchy correctly', () => {
    expect(roleRank('super_admin')).toBe(3);
    expect(roleRank('admin')).toBe(3);
    expect(roleRank('doctor')).toBe(2);
    expect(roleRank('manager')).toBe(2);
    expect(roleRank('staff')).toBe(1);

    expect(hasMinRole('admin', 'staff')).toBe(true);
    expect(hasMinRole('doctor', 'staff')).toBe(true);
    expect(hasMinRole('staff', 'admin')).toBe(false);
    expect(hasMinRole('doctor', 'admin')).toBe(false);
  });
});

describe('Strix Security Audit Suite - Webhook HMAC Signature Verification', () => {
  const testSecret = 'strix_audit_meta_secret_key_1234567890';

  it('validates correct HMAC-SHA256 signature', () => {
    process.env.META_APP_SECRET = testSecret;
    const rawPayload = JSON.stringify({ entry: [{ id: '123' }] });
    const expectedHash = crypto.createHmac('sha256', testSecret).update(rawPayload).digest('hex');
    const signatureHeader = `sha256=${expectedHash}`;

    expect(verifyMetaWebhookSignature(rawPayload, signatureHeader)).toBe(true);
  });

  it('rejects tampered webhook payloads', () => {
    process.env.META_APP_SECRET = testSecret;
    const rawPayload = JSON.stringify({ entry: [{ id: '123' }] });
    const tamperedPayload = JSON.stringify({ entry: [{ id: '123', injected: true }] });
    const signatureHeader = `sha256=${crypto.createHmac('sha256', testSecret).update(rawPayload).digest('hex')}`;

    expect(verifyMetaWebhookSignature(tamperedPayload, signatureHeader)).toBe(false);
  });

  it('fails closed when META_APP_SECRET is missing', () => {
    const orig = process.env.META_APP_SECRET;
    delete process.env.META_APP_SECRET;
    
    expect(verifyMetaWebhookSignature('{"test":1}', 'sha256=abcdef')).toBe(false);
    
    process.env.META_APP_SECRET = orig;
  });
});

import { encrypt, decrypt } from '@/lib/whatsapp/encryption';
import { generateApiKey, hashApiKey, looksLikeApiKey, timingSafeHexEqual } from '@/lib/api-keys/keys';
import { buildSignatureHeader, verifySignatureHeader } from '@/lib/webhooks/sign';
import { checkRateLimit, __resetRateLimitForTests } from '@/lib/rate-limit';

describe('Strix Security Audit Suite - AES-256-GCM Token Encryption', () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  const mockKey = crypto.randomBytes(32).toString('hex');

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = mockKey;
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it('encrypts and decrypts sensitive tokens losslessly with authenticated GCM', () => {
    const sensitive = 'EAABwb2...sensitive_meta_system_user_token...xyz987';
    const encrypted = encrypt(sensitive);
    expect(encrypted).not.toBe(sensitive);
    expect(encrypted.split(':').length).toBe(3); // iv:ciphertext:authTag

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(sensitive);
  });

  it('detects tampering in ciphertext and throws without leaking', () => {
    const sensitive = 'EAABwb2_test_token';
    const encrypted = encrypt(sensitive);
    const parts = encrypted.split(':');
    // Tamper with ciphertext
    const tamperedCt = parts[1].slice(0, -2) + (parts[1].slice(-2) === 'aa' ? 'bb' : 'aa');
    const tamperedPayload = `${parts[0]}:${tamperedCt}:${parts[2]}`;

    expect(() => decrypt(tamperedPayload)).toThrow();
  });
});

describe('Strix Security Audit Suite - API Key Security & Constant-Time Verification', () => {
  it('generates high-entropy keys with correct prefixes', () => {
    const key = generateApiKey();
    expect(key.plaintext.startsWith('wacrm_live_')).toBe(true);
    expect(key.hash.length).toBe(64); // SHA-256 hex
    expect(looksLikeApiKey(key.plaintext)).toBe(true);
    expect(looksLikeApiKey('invalid_key_format')).toBe(false);
  });

  it('compares key hashes using constant-time comparison to prevent timing attacks', () => {
    const hashA = hashApiKey('wacrm_live_test_123');
    const hashB = hashApiKey('wacrm_live_test_123');
    const hashC = hashApiKey('wacrm_live_test_999');

    expect(timingSafeHexEqual(hashA, hashB)).toBe(true);
    expect(timingSafeHexEqual(hashA, hashC)).toBe(false);
    expect(timingSafeHexEqual(hashA, 'short')).toBe(false);
  });
});

describe('Strix Security Audit Suite - Outbound Webhook Signing & Replay Protection', () => {
  const secret = 'whsec_strix_audit_test_secret_key_12345';
  const payload = JSON.stringify({ event: 'appointment.confirmed', id: 'appt_123' });
  const now = 1700000000;

  it('generates valid timestamped signature header', () => {
    const header = buildSignatureHeader(payload, secret, now);
    expect(header).toContain(`t=${now}`);
    expect(header).toContain('v1=');

    expect(verifySignatureHeader(header, payload, secret, now, 300)).toBe(true);
  });

  it('rejects replayed webhook requests outside the tolerance window', () => {
    const header = buildSignatureHeader(payload, secret, now);
    // Request arriving 600s later (tolerance is 300s)
    const futureTime = now + 600;
    expect(verifySignatureHeader(header, payload, secret, futureTime, 300)).toBe(false);
  });
});

describe('Strix Security Audit Suite - In-Memory Fixed-Window Rate Limiter', () => {
  beforeEach(() => {
    __resetRateLimitForTests();
  });

  it('strictly bounds request rates and enforces 429 triggers', () => {
    const key = 'test_ip_192.0.2.1';
    const opts = { limit: 3, windowMs: 1000 };

    const r1 = checkRateLimit(key, opts);
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(key, opts);
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(key, opts);
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4th request exceeds limit
    const r4 = checkRateLimit(key, opts);
    expect(r4.success).toBe(false);
    expect(r4.remaining).toBe(0);
  });
});
