'use strict';

/**
 * Module dependencies
 */
var idxesPolicy = require('../policies/idxes.server.policy'),
  idxes = require('../controllers/idxes.server.controller');

module.exports = function(app) {
  // Idxes Routes
  app.route('/api/idxes').all(idxesPolicy.isAllowed)
    .get(idxes.list)
    .post(idxes.create);

  app.route('/api/idxes/:idxId').all(idxesPolicy.isAllowed)
    .get(idxes.read)
    .put(idxes.update)
    .delete(idxes.delete);

  // Finish by binding the Idx middleware
  app.param('idxId', idxes.idxByID);
};
