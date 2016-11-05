'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
  mongoose = require('mongoose'),
  Log = mongoose.model('Log'),
  logger = require(path.resolve('./modules/core/server/controllers/logger.server.controller')),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller'));

/**
 * Show the current log
 */
exports.read = function (req, res) {
  res.json(req.log);
};

/**
 * Delete an log
 */
exports.delete = function (req, res) {
  var log = req.log;

  log.remove(function (err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(log);
    }
  });
};

/**
 * List of Logs
 */
exports.list = function (req, res) {
  Log.find().sort('-created').populate('user', 'displayName').exec(function (err, logs) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(logs);
    }
  });
};

/**
* Paginate List of Logs
**/
exports.logList = function(req, res){
  var resdata = {count:0, table:[], logs:[]};
  var page = 1;
  if(req.params.page) {
    page = req.params.page;
  }
  var per_page = 20;
  if(req.params.per) {
    per_page = req.params.per;
  }
  var cond = {level: {$in:['info','error']}};
  if(req.params.level && req.params.level !== 'all') {
    cond = {level:req.params.level};
  }
  
  Log.find(cond).limit(100000).count(function(err, count) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      resdata.count = count;
  
      Log.find(cond).limit(100000).sort('-timestamp').skip((page-1)*per_page).limit(per_page).populate('user', 'displayName').exec(function(err, logs) {
        if (err) {
          return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
          });
        } else {
          resdata.logs = logs;
          res.json(resdata);
        }
      });
    }
  });
};

/**
 * Log middleware
 */
/*exports.logByID = function (req, res, next, id) {

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({
      message: 'Log is invalid'
    });
  }

  Log.findById(id).populate('user', 'displayName').exec(function (err, log) {
    if (err) {
      return next(err);
    } else if (!log) {
      return res.status(404).send({
        message: 'No log with that identifier has been found'
      });
    }
    req.log = log;
    next();
  });
};*/

exports.readCrawlLog = function (req, res) {
  Log.find({
    'meta.type': 'crawlResult',
    'meta.crawlId': req.params.crawlId
  }, {}, {sort:{timestamp: 1}}).exec(function (err, logs) {
    if (err) {
      return res.status(400).send({
        message: 'Log is invalid'
      });
    } else if (!logs) {
      return res.status(404).send({
        message: 'No log with that identifier has been found'
      });
    }
    res.json({
      count: logs.length,
      data:logs
    });
  });
};
