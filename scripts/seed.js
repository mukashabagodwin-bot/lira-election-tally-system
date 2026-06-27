const crypto = require('crypto');
const {
  sequelize,
  District,
  Constituency,
  Station,
  Candidate,
  User,
  TallyBatch,
  TallyLine,
  RejectedBallot,
  AuditLog,
  EventOutbox
} = require('../src/infrastructure/orm/database');
const { hashPassword } = require('../src/infrastructure/security/passwords');
const { stableHash } = require('../src/domain/electionRules');

const rejectedReasons = [
  'Unclear voter mark',
  'Multiple candidates marked',
  'Spoilt ballot paper',
  'Missing official stamp',
  'Voter identity challenge'
];

async function createMany(model, rows) {
  const created = [];
  for (const row of rows) {
    created.push(await model.create(row));
  }
  return created;
}

function buildRejectedBallots(count) {
  return Array.from({ length: count }, (_, index) => ({
    sequenceNumber: index + 1,
    reason: rejectedReasons[index % rejectedReasons.length],
    note: index % 7 === 0 ? 'Seed sample review note' : null
  }));
}

async function main() {
  await sequelize.sync({ force: true });
  const passwordHash = await hashPassword('Password123!');

  const district = await District.create({ code: 'LIRA', name: 'Lira District' });
  const east = await Constituency.create({ code: 'LIRA-EAST', name: 'Lira City East', DistrictId: district.id });
  const west = await Constituency.create({ code: 'LIRA-WEST', name: 'Lira City West', DistrictId: district.id });
  const eruteNorth = await Constituency.create({ code: 'ERUTE-N', name: 'Erute North', DistrictId: district.id });
  const eruteSouth = await Constituency.create({ code: 'ERUTE-S', name: 'Erute South', DistrictId: district.id });

  const stations = await createMany(Station, [
    { code: 'LRA-001', name: 'Lira Town College', parish: 'Adyel', registeredVoters: 1240, ConstituencyId: east.id },
    { code: 'LRA-002', name: 'Railway Primary School', parish: 'Railways', registeredVoters: 980, ConstituencyId: east.id },
    { code: 'LRA-009', name: 'Adyel Police Post', parish: 'Adyel West', registeredVoters: 1010, ConstituencyId: east.id },
    { code: 'LRA-003', name: 'Ojwina Community Hall', parish: 'Ojwina', registeredVoters: 1115, ConstituencyId: west.id },
    { code: 'LRA-004', name: 'Central Market Yard', parish: 'Central', registeredVoters: 1360, ConstituencyId: west.id },
    { code: 'LRA-005', name: 'Agweng Subcounty Hall', parish: 'Agweng', registeredVoters: 860, ConstituencyId: eruteNorth.id },
    { code: 'LRA-006', name: 'Aromo Primary School', parish: 'Aromo', registeredVoters: 790, ConstituencyId: eruteNorth.id },
    { code: 'LRA-007', name: 'Barr Health Centre', parish: 'Barr', registeredVoters: 905, ConstituencyId: eruteSouth.id },
    { code: 'LRA-008', name: 'Amach Trading Centre', parish: 'Amach', registeredVoters: 1030, ConstituencyId: eruteSouth.id }
  ]);

  const candidates = await createMany(Candidate, [
    { electionCode: 'LIRA_MAYOR_2026', ballotNumber: 1, name: 'Akello Grace', party: 'UPC' },
    { electionCode: 'LIRA_MAYOR_2026', ballotNumber: 2, name: 'Okello Martin', party: 'NRM' },
    { electionCode: 'LIRA_MAYOR_2026', ballotNumber: 3, name: 'Auma Patricia', party: 'NUP' },
    { electionCode: 'LIRA_MAYOR_2026', ballotNumber: 4, name: 'Ocen Denis', party: 'Independent' },
    { electionCode: 'LIRA_MP_2026', ballotNumber: 1, name: 'Acan Betty', party: 'FDC' },
    { electionCode: 'LIRA_MP_2026', ballotNumber: 2, name: 'Okwir James', party: 'NRM' },
    { electionCode: 'LIRA_MP_2026', ballotNumber: 3, name: 'Atim Sarah', party: 'UPC' },
    { electionCode: 'LIRA_MP_2026', ballotNumber: 4, name: 'Odongo Peter', party: 'Independent' },
    { electionCode: 'LIRA_LC5_2026', ballotNumber: 1, name: 'Okello David', party: 'NRM' },
    { electionCode: 'LIRA_LC5_2026', ballotNumber: 2, name: 'Apio Margaret', party: 'UPC' },
    { electionCode: 'LIRA_LC5_2026', ballotNumber: 3, name: 'Otieno Simon', party: 'Independent' },
    { electionCode: 'LIRA_LC3_2026', ballotNumber: 1, name: 'Opio Charles', party: 'NRM' },
    { electionCode: 'LIRA_LC3_2026', ballotNumber: 2, name: 'Auma Kevin', party: 'NUP' },
    { electionCode: 'LIRA_LC3_2026', ballotNumber: 3, name: 'Nyeko Rose', party: 'UPC' }
  ]);

const users = await createMany(User, [
  { name: 'National Admin', email: 'admin@lira-tally.test', passwordHash, role: 'national_admin', DistrictId: district.id, allowedSubnets: '' },
  { name: 'Lira DRO', email: 'dro@lira-tally.test', passwordHash, role: 'district_returning_officer', DistrictId: district.id, allowedSubnets: '' },
  { name: 'City East Supervisor', email: 'supervisor@lira-tally.test', passwordHash, role: 'constituency_supervisor', DistrictId: district.id, ConstituencyId: east.id, allowedSubnets: '' },
  { name: 'Adyel Polling Officer', email: 'officer@lira-tally.test', passwordHash, role: 'polling_officer', DistrictId: district.id, ConstituencyId: east.id, StationId: stations[0].id, allowedSubnets: '' },
  { name: 'Election Observer', email: 'observer@lira-tally.test', passwordHash, role: 'observer', DistrictId: district.id, allowedSubnets: '' },
  { name: 'Audit Clerk', email: 'auditor@lira-tally.test', passwordHash, role: 'auditor', DistrictId: district.id, allowedSubnets: '' }
]);

  const admin = users[0];
  const reviewer = users[1];
  const sampleRows = [
    { station: stations[0], status: 'verified', invalidVotes: 18, votes: [420, 310, 205, 72] },
    { station: stations[1], status: 'verified', invalidVotes: 13, votes: [280, 330, 155, 61] },
    { station: stations[2], status: 'verified', invalidVotes: 21, votes: [350, 290, 240, 80] },
    { station: stations[3], status: 'pending', invalidVotes: 19, votes: [390, 410, 211, 94] },
    { station: stations[4], status: 'verified', invalidVotes: 12, votes: [240, 260, 115, 49] },
    { station: stations[5], status: 'rejected', invalidVotes: 30, votes: [400, 410, 210, 99] }
  ];

  for (const row of sampleRows) {
    const rejectedBallots = buildRejectedBallots(row.invalidVotes);
    const totalValidVotes = row.votes.reduce((sum, value) => sum + value, 0);
    const totalVotes = totalValidVotes + rejectedBallots.length;
    const requestId = crypto.randomUUID();
    const batch = await TallyBatch.create({
      StationId: row.station.id,
      submitted_by_id: admin.id,
      verified_by_id: row.status === 'pending' ? null : reviewer.id,
      electionCode: 'LIRA_MAYOR_2026',
      status: row.status,
      requestId,
      bodyHash: stableHash({ stationId: row.station.id, votes: row.votes, rejectedBallots }),
      registeredVotersSnapshot: row.station.registeredVoters,
      invalidVotes: rejectedBallots.length,
      totalValidVotes,
      totalVotes,
      batchVersion: 1,
      sourceIp: '127.0.0.1',
      deviceFingerprint: 'seed-data',
      verifiedAt: row.status === 'pending' ? null : new Date(),
      rejectionReason: row.status === 'rejected' ? 'Seed example: turnout exceeded manual review threshold.' : null
    });

    await createMany(TallyLine, row.votes.map((votes, index) => ({
      TallyBatchId: batch.id,
      CandidateId: candidates[index].id,
      votes
    })));

    await createMany(RejectedBallot, rejectedBallots.map((ballot) => ({
      TallyBatchId: batch.id,
      sequenceNumber: ballot.sequenceNumber,
      reason: ballot.reason,
      note: ballot.note
    })));

    await EventOutbox.create({
      type: 'tally.seeded',
      aggregateType: 'TallyBatch',
      aggregateId: String(batch.id),
      payload: { status: row.status, stationCode: row.station.code, rejectedVotes: rejectedBallots.length }
    });

    await AuditLog.create({
      actor_id: admin.id,
      role: admin.role,
      action: 'seed.tally',
      entity: 'TallyBatch',
      entityId: String(batch.id),
      sourceIp: '127.0.0.1',
      traceId: 'seed-' + batch.id,
      details: { stationCode: row.station.code, status: row.status, rejectedVotes: rejectedBallots.length }
    });
  }

  console.log('Seed complete. Demo password: Password123!');
  await sequelize.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
