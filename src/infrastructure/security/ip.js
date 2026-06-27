function normalizeIp(ip) {
  if (!ip) return '';
  const value = String(ip).trim();
  if (value === '::1') return '127.0.0.1';
  if (value === '::ffff:127.0.0.1') return '127.0.0.1';
  return value.replace('::ffff:', '');
}

function displayIp(ip) {
  const normalized = normalizeIp(ip);
  if (!normalized || normalized === 'unknown') return 'Unknown';
  if (normalized === '127.0.0.1') return '127.0.0.1 (localhost)';
  return normalized;
}

function ipv4ToLong(ip) {
  const parts = normalizeIp(ip).split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return null;
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
}

function matchesCidr(ip, cidr) {
  const normalizedIp = normalizeIp(ip);
  const normalizedCidr = normalizeIp(cidr);
  if (!normalizedCidr || normalizedCidr === '*') return true;
  if (!normalizedCidr.includes('/')) return normalizedIp === normalizedCidr;

  const [range, bitsRaw] = normalizedCidr.split('/');
  const bits = Number(bitsRaw);
  if (range.includes(':')) {
    return bits === 128 && (ip === range || normalizedIp === range);
  }

  const ipLong = ipv4ToLong(normalizedIp);
  const rangeLong = ipv4ToLong(range);
  if (ipLong === null || rangeLong === null || Number.isNaN(bits)) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipLong & mask) === (rangeLong & mask);
}

function ipAllowed(ip, cidrs) {
  if (!cidrs || cidrs.length === 0) return true;
  return cidrs.some((cidr) => matchesCidr(ip, cidr));
}

module.exports = { normalizeIp, displayIp, matchesCidr, ipAllowed };
