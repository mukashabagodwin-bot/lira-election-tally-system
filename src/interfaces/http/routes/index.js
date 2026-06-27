const express = require('express');
const auth = require('../controllers/authController');
const dashboard = require('../controllers/dashboardController');
const tally = require('../controllers/tallyController');
const stations = require('../controllers/stationController');
const admin = require('../controllers/adminController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { gatewayFilter } = require('../middleware/security');

const router = express.Router();

router.get('/login', auth.loginPage);
router.post('/login', auth.login);
router.post('/logout', requireAuth, auth.logout);

router.get('/', requireAuth, requirePermission('dashboard:view'), dashboard.dashboard);
router.get('/stations', requireAuth, requirePermission('dashboard:view'), stations.index);

router.get('/tallies/new', requireAuth, requirePermission('tally:submit'), tally.newTally);
router.post('/tallies', requireAuth, requirePermission('tally:submit'), tally.createTally);
router.get('/tallies/queue', requireAuth, requirePermission('tally:verify'), tally.verificationQueue);
router.post('/tallies/:id/review', requireAuth, requirePermission('tally:verify'), tally.reviewTally);
router.get('/tallies/:id', requireAuth, requirePermission('dashboard:view'), tally.batchDetails);

router.get('/admin/audit', requireAuth, requirePermission('audit:view'), admin.audit);
router.get('/admin/architecture', requireAuth, requirePermission('admin:view'), admin.architecturePage);

router.get('/api/metrics', gatewayFilter, requireAuth, requirePermission('dashboard:view'), dashboard.metricsApi);
router.post('/api/token', gatewayFilter, requireAuth, auth.issueToken);

module.exports = router;
