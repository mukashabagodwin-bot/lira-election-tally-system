const { Station, Constituency, District, TallyBatch } = require('../../../infrastructure/orm/database');
const { canAccessStation } = require('../../../infrastructure/security/policies');

async function index(req, res, next) {
  try {
    const stations = (await Station.findAll({
      include: [
        { model: Constituency, include: [District] },
        { model: TallyBatch, required: false }
      ],
      order: [[Constituency, 'name', 'ASC'], ['name', 'ASC']]
    })).filter((station) => canAccessStation(req.user, station));
    res.render('stations/index', { title: 'Stations', stations });
  } catch (error) {
    next(error);
  }
}

module.exports = { index };
