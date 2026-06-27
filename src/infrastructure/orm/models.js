module.exports = (sequelize, DataTypes) => {
  const District = sequelize.define('District', {
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false }
  }, { underscored: true });

  const Constituency = sequelize.define('Constituency', {
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false }
  }, { underscored: true });

  const Station = sequelize.define('Station', {
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    parish: { type: DataTypes.STRING, allowNull: false },
    registeredVoters: { type: DataTypes.INTEGER, allowNull: false, field: 'registered_voters', validate: { min: 1 } },
    status: { type: DataTypes.ENUM('open', 'closed', 'quarantined'), defaultValue: 'open' }
  }, {
    underscored: true,
    indexes: [{ fields: ['code'] }, { fields: ['constituency_id', 'status'] }]
  });

  const Candidate = sequelize.define('Candidate', {
    electionCode: { type: DataTypes.STRING, allowNull: false, field: 'election_code' },
    ballotNumber: { type: DataTypes.INTEGER, allowNull: false, field: 'ballot_number' },
    name: { type: DataTypes.STRING, allowNull: false },
    party: { type: DataTypes.STRING, allowNull: false }
  }, {
    underscored: true,
    indexes: [{ unique: true, fields: ['election_code', 'ballot_number'] }]
  });

  const User = sequelize.define('User', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    passwordHash: { type: DataTypes.STRING, allowNull: false, field: 'password_hash' },
    role: { type: DataTypes.ENUM('national_admin', 'district_returning_officer', 'constituency_supervisor', 'polling_officer', 'observer', 'auditor'), allowNull: false },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
    allowedSubnets: { type: DataTypes.TEXT, defaultValue: '', field: 'allowed_subnets' },
    externalSubject: { type: DataTypes.STRING, allowNull: true, field: 'external_subject' }
  }, {
    underscored: true,
    indexes: [{ fields: ['email'] }, { fields: ['role', 'active'] }]
  });

  const TallyBatch = sequelize.define('TallyBatch', {
    electionCode: { type: DataTypes.STRING, allowNull: false, defaultValue: 'LIRA_MAYOR_2026', field: 'election_code' },
    status: { type: DataTypes.ENUM('pending', 'verified', 'rejected', 'superseded'), defaultValue: 'pending' },
    requestId: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'request_id' },
    bodyHash: { type: DataTypes.STRING, allowNull: false, field: 'body_hash' },
    registeredVotersSnapshot: { type: DataTypes.INTEGER, allowNull: false, field: 'registered_voters_snapshot' },
    invalidVotes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'invalid_votes', validate: { min: 0 } },
    totalValidVotes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'total_valid_votes', validate: { min: 0 } },
    totalVotes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'total_votes', validate: { min: 0 } },
    batchVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'batch_version' },
    sourceIp: { type: DataTypes.STRING, allowNull: false, field: 'source_ip' },
    deviceFingerprint: { type: DataTypes.STRING, allowNull: true, field: 'device_fingerprint' },
    rejectionReason: { type: DataTypes.TEXT, allowNull: true, field: 'rejection_reason' },
    submittedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'submitted_at' },
    verifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'verified_at' }
  }, {
    underscored: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['station_id', 'election_code', 'status'] },
      { fields: ['submitted_at'] },
      { unique: true, fields: ['station_id', 'election_code', 'batch_version'] }
    ]
  });

  const TallyLine = sequelize.define('TallyLine', {
    votes: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } }
  }, {
    underscored: true,
    indexes: [{ unique: true, fields: ['tally_batch_id', 'candidate_id'] }, { fields: ['candidate_id'] }]
  });

  const RejectedBallot = sequelize.define('RejectedBallot', {
    sequenceNumber: { type: DataTypes.INTEGER, allowNull: false, field: 'sequence_number', validate: { min: 1 } },
    reason: { type: DataTypes.STRING, allowNull: false },
    note: { type: DataTypes.TEXT, allowNull: true }
  }, {
    underscored: true,
    indexes: [
      { fields: ['tally_batch_id'] },
      { fields: ['reason'] },
      { unique: true, fields: ['tally_batch_id', 'sequence_number'] }
    ]
  });

  const IdempotencyKey = sequelize.define('IdempotencyKey', {
    key: { type: DataTypes.STRING, allowNull: false, unique: true },
    method: { type: DataTypes.STRING, allowNull: false },
    path: { type: DataTypes.STRING, allowNull: false },
    bodyHash: { type: DataTypes.STRING, allowNull: false, field: 'body_hash' },
    statusCode: { type: DataTypes.INTEGER, allowNull: true, field: 'status_code' },
    responseJson: { type: DataTypes.JSON, allowNull: true, field: 'response_json' },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' }
  }, {
    underscored: true,
    indexes: [{ fields: ['key'] }, { fields: ['expires_at'] }]
  });

  const AuditLog = sequelize.define('AuditLog', {
    action: { type: DataTypes.STRING, allowNull: false },
    entity: { type: DataTypes.STRING, allowNull: false },
    entityId: { type: DataTypes.STRING, allowNull: true, field: 'entity_id' },
    role: { type: DataTypes.STRING, allowNull: false },
    sourceIp: { type: DataTypes.STRING, allowNull: false, field: 'source_ip' },
    traceId: { type: DataTypes.STRING, allowNull: false, field: 'trace_id' },
    details: { type: DataTypes.JSON, allowNull: true }
  }, {
    underscored: true,
    indexes: [{ fields: ['trace_id'] }, { fields: ['created_at'] }, { fields: ['action'] }]
  });

  const EventOutbox = sequelize.define('EventOutbox', {
    type: { type: DataTypes.STRING, allowNull: false },
    aggregateType: { type: DataTypes.STRING, allowNull: false, field: 'aggregate_type' },
    aggregateId: { type: DataTypes.STRING, allowNull: false, field: 'aggregate_id' },
    payload: { type: DataTypes.JSON, allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'published', 'blocked', 'failed'), defaultValue: 'pending' },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    availableAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'available_at' }
  }, {
    underscored: true,
    indexes: [{ fields: ['status', 'available_at'] }, { fields: ['aggregate_type', 'aggregate_id'] }]
  });

  District.hasMany(Constituency, { foreignKey: { name: 'DistrictId', field: 'district_id', allowNull: false } });
  Constituency.belongsTo(District, { foreignKey: { name: 'DistrictId', field: 'district_id', allowNull: false } });
  Constituency.hasMany(Station, { foreignKey: { name: 'ConstituencyId', field: 'constituency_id', allowNull: false } });
  Station.belongsTo(Constituency, { foreignKey: { name: 'ConstituencyId', field: 'constituency_id', allowNull: false } });

  User.belongsTo(District, { foreignKey: { name: 'DistrictId', field: 'district_id' }, constraints: false });
  User.belongsTo(Constituency, { foreignKey: { name: 'ConstituencyId', field: 'constituency_id' }, constraints: false });
  User.belongsTo(Station, { foreignKey: { name: 'StationId', field: 'station_id' }, constraints: false });

  Station.hasMany(TallyBatch, { foreignKey: { name: 'StationId', field: 'station_id', allowNull: false } });
  TallyBatch.belongsTo(Station, { foreignKey: { name: 'StationId', field: 'station_id', allowNull: false } });
  TallyBatch.belongsTo(User, { as: 'submittedBy', foreignKey: { name: 'submitted_by_id', field: 'submitted_by_id', allowNull: false } });
  TallyBatch.belongsTo(User, { as: 'verifiedBy', foreignKey: { name: 'verified_by_id', field: 'verified_by_id', allowNull: true } });

  TallyBatch.hasMany(TallyLine, { foreignKey: { name: 'TallyBatchId', field: 'tally_batch_id', allowNull: false }, onDelete: 'CASCADE' });
  TallyLine.belongsTo(TallyBatch, { foreignKey: { name: 'TallyBatchId', field: 'tally_batch_id', allowNull: false } });
  TallyLine.belongsTo(Candidate, { foreignKey: { name: 'CandidateId', field: 'candidate_id', allowNull: false } });
  Candidate.hasMany(TallyLine, { foreignKey: { name: 'CandidateId', field: 'candidate_id', allowNull: false } });

  TallyBatch.hasMany(RejectedBallot, { foreignKey: { name: 'TallyBatchId', field: 'tally_batch_id', allowNull: false }, onDelete: 'CASCADE' });
  RejectedBallot.belongsTo(TallyBatch, { foreignKey: { name: 'TallyBatchId', field: 'tally_batch_id', allowNull: false } });

  User.hasMany(AuditLog, { as: 'auditLogs', foreignKey: { name: 'actor_id', field: 'actor_id', allowNull: true }, constraints: false });
  AuditLog.belongsTo(User, { as: 'actor', foreignKey: { name: 'actor_id', field: 'actor_id', allowNull: true }, constraints: false });

  return {
    District,
    Constituency,
    Station,
    Candidate,
    User,
    TallyBatch,
    TallyLine,
    RejectedBallot,
    IdempotencyKey,
    AuditLog,
    EventOutbox
  };
};
