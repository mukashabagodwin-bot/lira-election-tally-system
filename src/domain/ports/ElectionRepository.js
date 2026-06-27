class ElectionRepository {
  async withTransaction() { throw new Error('Not implemented'); }
  async findStationWithScope() { throw new Error('Not implemented'); }
  async saveTallyBatch() { throw new Error('Not implemented'); }
  async readDashboardMetrics() { throw new Error('Not implemented'); }
}

module.exports = ElectionRepository;
