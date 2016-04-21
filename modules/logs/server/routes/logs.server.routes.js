'use strict';

/**
 * Module dependencies.
 */
var logsPolicy = require('../policies/logs.server.policy'),
  logs = require('../controllers/logs.server.controller');

module.exports = function (app) {
  // Logs collection routes
  app.route('/api/logs').all(logsPolicy.isAllowed)
    .get(logs.list);
    //.post(logs.create);

  app.route('/api/logs/list/:page/:per/').all(logsPolicy.isAllowed)
    .get(logs.logList);  // Single log routes
  app.route('/api/logs/list/:page/:per/:level').all(logsPolicy.isAllowed)
    .get(logs.logList);  // Single log routes
    
  app.route('/api/logs/:logId').all(logsPolicy.isAllowed)
    .get(logs.read)
    //.put(logs.update)
    .delete(logs.delete);


  // Finish by binding the log middleware
  //app.param('logId', logs.logByID);
  
  app.route('/api/logs/crawl/:crawlId').all(logsPolicy.isAllowed)
    .get(logs.readCrawlLog);
    
};
