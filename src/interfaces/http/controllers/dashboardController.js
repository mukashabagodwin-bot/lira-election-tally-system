const { getDashboardMetrics } = require('../../../application/queries/dashboardQueries');
const { electionSchemes, defaultElectionCode, getElectionScheme } = require('../../../config/electionSchemes');

async function dashboard(req, res, next) {
  try {
    const selectedElection = getElectionScheme(req.query.electionCode || defaultElectionCode);
    const metrics = await getDashboardMetrics(req.user, selectedElection.code);
    res.render('dashboard/index', { title: 'Election dashboard', metrics, electionSchemes, selectedElection });
  } catch (error) {
    next(error);
  }
}

async function metricsApi(req, res, next) {
  try {
    const selectedElection = getElectionScheme(req.query.electionCode || defaultElectionCode);
    res.json(await getDashboardMetrics(req.user, selectedElection.code));
  } catch (error) {
    next(error);
  }
}

module.exports = { dashboard, metricsApi };
