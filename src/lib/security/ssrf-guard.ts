import { isIP } from 'node:net';

/**
 * Validates whether a given URL is safe to fetch from the server.
 * Blocks:
 *   - Non-HTTP(S) protocols (e.g. file:, ftp:, gopher:, dict:, data:)
 *   - Localhost / loopback addresses (127.0.0.1, ::1, localhost, 0.0.0.0)
 *   - Private network ranges (RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 *   - Link-local and Cloud metadata endpoints (169.254.0.0/16, metadata.google.internal)
 *   - IPv6 link-local (fe80::/10) and unique local (fc00::/7)
 *   - Obfuscated decimal/hexadecimal IP notation
 */
export function isSafeUrl(urlString: string): { safe: boolean; reason?: string; url?: URL } {
  if (!urlString || typeof urlString !== 'string') {
    return { safe: false, reason: 'URL is required' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    try {
      parsed = new URL(`https://${urlString}`);
    } catch {
      return { safe: false, reason: 'Invalid URL format' };
    }
  }

  // Strictly enforce http/https protocols only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `Protocol '${parsed.protocol}' is forbidden. Only HTTP and HTTPS are permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // Block empty or loopback hostnames
  if (!hostname || hostname === 'localhost' || hostname === 'localhost.localdomain' || hostname.endsWith('.localhost')) {
    return { safe: false, reason: 'Access to localhost is forbidden.' };
  }

  // Block internal domain suffixes
  const blockedSuffixes = ['.local', '.internal', '.lan', '.home', '.corp', '.corp.local'];
  if (blockedSuffixes.some(suffix => hostname.endsWith(suffix))) {
    return { safe: false, reason: 'Access to internal network domains is forbidden.' };
  }

  // Block cloud metadata hostnames
  if (hostname === 'metadata.google.internal' || hostname === 'instance-data' || hostname.includes('metadata.azure')) {
    return { safe: false, reason: 'Access to cloud instance metadata is strictly forbidden.' };
  }

  // Check for raw IP addresses or decimal/octal/hex notation
  if (isIP(hostname)) {
    if (isPrivateOrBlockedIP(hostname)) {
      return { safe: false, reason: 'Access to private or reserved IP address is forbidden.' };
    }
  }

  // Check for decimal integer IP (e.g. 2130706433 = 127.0.0.1) or hex IP (0x7f000001)
  if (/^0x[0-9a-f]+$/i.test(hostname) || /^\d+$/.test(hostname)) {
    return { safe: false, reason: 'Obfuscated numerical IP addresses are forbidden.' };
  }

  return { safe: true, url: parsed };
}

/**
 * Checks if an IPv4 or IPv6 string falls in private, loopback, or cloud-metadata ranges.
 */
export function isPrivateOrBlockedIP(ip: string): boolean {
  // IPv4 Loopback (127.0.0.0/8) or 0.0.0.0
  if (ip === '0.0.0.0' || ip.startsWith('127.')) return true;

  // RFC 1918 Private IPv4:
  // 10.0.0.0 - 10.255.255.255
  if (ip.startsWith('10.')) return true;

  // 172.16.0.0 - 172.31.255.255
  const parts = ip.split('.').map(p => parseInt(p, 10));
  if (parts.length === 4) {
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0 - 192.168.255.255
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 Link-local / Cloud Metadata (169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 100.64.0.0/10 Carrier-grade NAT
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  }

  // IPv6 checks
  const lowerIp = ip.toLowerCase();
  if (
    lowerIp === '::1' ||
    lowerIp === '::' ||
    lowerIp.startsWith('fe80:') || // Link-local
    lowerIp.startsWith('fc') ||    // Unique local
    lowerIp.startsWith('fd') ||    // Unique local
    lowerIp.startsWith('::ffff:127.') || // IPv4-mapped loopback
    lowerIp.startsWith('::ffff:10.') ||  // IPv4-mapped private
    lowerIp.startsWith('::ffff:192.168.') ||
    lowerIp.startsWith('::ffff:169.254.')
  ) {
    return true;
  }

  return false;
}
