'use strict';

/**
 * Module dependencies.
 */
var crawlersPolicy = require('../policies/crawlers.server.policy'),
  crawlers = require('../controllers/crawlers.server.controller');

module.exports = function (app) {
  // Articles collection routes
  app.route('/api/crawlers').all(crawlersPolicy.isAllowed)
    .get(crawlers.list)
    .post(crawlers.create);

  app.route('/api/crawlers/user').all(crawlersPolicy.isAllowed)
    .get(crawlers.listByUser);

  // クロール実行
  app.route('/api/crawlers/:crawlerId/reserve').all(crawlersPolicy.isAllowed)
    .get(crawlers.reserve);

  // クロール実行
  app.route('/api/crawlers/:crawlerId/now').all(crawlersPolicy.isAllowed)
    .get(crawlers.now);

  // クロール実行
  app.route('/api/crawlers/:crawlerId/start').all(crawlersPolicy.isAllowed)
    .get(crawlers.start);

  // クロール結果の出力
  app.route('/api/crawlers/:crawlerId/data.:extension').all(crawlersPolicy.isAllowed)
    .get(crawlers.data);

  // Single crawler routes
  app.route('/api/crawlers/:crawlerId').all(crawlersPolicy.isAllowed)
    .get(crawlers.read)
    .put(crawlers.update)
    .delete(crawlers.delete);

  // Finish by binding the crawler middleware
  app.param('crawlerId', crawlers.crawlerByID);
  
  // 
  app.param('extension', crawlers.detectExtension);
  

};
