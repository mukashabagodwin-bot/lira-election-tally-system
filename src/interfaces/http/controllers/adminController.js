const { getAuditTrail } = require('../../../application/queries/dashboardQueries');
const architecture = require('../../../config/architecture');
const relationalStrategy = require('../../../config/relationalStrategy');

async function audit(req, res, next) {
  try {
    const logs = await getAuditTrail(80);
    res.render('admin/audit', { title: 'Audit trail', logs });
  } catch (error) {
    next(error);
  }
}

function architecturePage(req, res) {
  res.render('admin/architecture', { title: 'Architecture', architecture, relationalStrategy });
}

module.exports = { audit, architecturePage };
