const { ipAllowed } = require('./ip');

const permissions = {
  national_admin: ['dashboard:view', 'tally:submit', 'tally:verify', 'tally:reject', 'audit:view', 'admin:view'],
  district_returning_officer: ['dashboard:view', 'tally:verify', 'tally:reject'],
  constituency_supervisor: ['dashboard:view', 'tally:verify', 'tally:reject'],
  polling_officer: ['dashboard:view', 'tally:submit'],
  observer: ['dashboard:view'],
  auditor: ['dashboard:view', 'audit:view']
};

function hasPermission(user, permission) {
  return Boolean(user && user.active && permissions[user.role] && permissions[user.role].includes(permission));
}

function userAllowedFromIp(user, ip) {
  if (!user || !user.allowedSubnets) return true;
  const cidrs = String(user.allowedSubnets).split(',').map((item) => item.trim()).filter(Boolean);
  return cidrs.length === 0 || ipAllowed(ip, cidrs);
}

function canAccessStation(user, station) {
  if (!user || !station) return false;
  if (user.role === 'national_admin' || user.role === 'observer' || user.role === 'auditor') return true;
  if (user.role === 'district_returning_officer') return Number(user.DistrictId) === Number(station.Constituency.DistrictId);
  if (user.role === 'constituency_supervisor') return Number(user.ConstituencyId) === Number(station.ConstituencyId);
  if (user.role === 'polling_officer') return Number(user.ConstituencyId) === Number(station.ConstituencyId);
  return false;
}

function canSubmitForStation(user, station) {
  return hasPermission(user, 'tally:submit') && canAccessStation(user, station) && station.status === 'open';
}

function canVerifyBatch(user, batch) {
  if (!hasPermission(user, 'tally:verify') || !batch || !batch.Station) return false;
  return canAccessStation(user, batch.Station);
}

function canViewAudit(user) {
  return hasPermission(user, 'audit:view');
}

module.exports = {
  permissions,
  hasPermission,
  userAllowedFromIp,
  canAccessStation,
  canSubmitForStation,
  canVerifyBatch,
  canViewAudit
};
