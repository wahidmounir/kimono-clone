'use strict';

/**
 * Module dependencies
 */
var agendajobsPolicy = require('../policies/agendajobs.server.policy'),
  agendajobs = require('../controllers/agendajobs.server.controller');

module.exports = function(app) {
  // Agendajobs Routes
  app.route('/api/agendajobs').all(agendajobsPolicy.isAllowed)
    .get(agendajobs.list)
    .post(agendajobs.comm);

  app.route('/api/agendajobs/:agendajobId').all(agendajobsPolicy.isAllowed)
    .get(agendajobs.read)
    .post(agendajobs.touch)
    .put(agendajobs.update)
    .delete(agendajobs.delete);

  // Finish by binding the Agendajob middleware
  app.param('agendajobId', agendajobs.agendajobByID);
};
