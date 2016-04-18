'use strict';

/**
 * Module dependencies.
 */
var crawlsPolicy = require('../policies/crawls.server.policy'),
  crawls = require('../controllers/crawls.server.controller');

module.exports = function (app) {
  // Articles collection routes
  app.route('/api/crawls').all(crawlsPolicy.isAllowed)
    .get(crawls.list)
    .post(crawls.create);

  app.route('/api/crawls/start').all(crawlsPolicy.isAllowed)
    .put(crawls.start);

  // Single crawl routes
  app.route('/api/crawls/:crawlId').all(crawlsPolicy.isAllowed)
    .get(crawls.read)
    .put(crawls.update)
    .delete(crawls.delete);

  // Finish by binding the crawl middleware
  app.param('crawlId', crawls.crawlByID);
};
