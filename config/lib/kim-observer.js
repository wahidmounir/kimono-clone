'use strict';

/**
 * Module dependencies.
 */
var config = require('../config'),
  path = require('path'),
  mongoose = require('mongoose'),
  Log = mongoose.model('Log'),
  nodemailer = require('nodemailer'),
  logger = require(path.resolve('./modules/core/server/controllers/logger.server.controller'));


var smtpTransport = nodemailer.createTransport('SMTP', config.mailer.options);


exports.prepare = function (options, callback) {
  // System log reporting
  options.agenda.define('Reporting System Logs', {concurrency: 1}, function ( job, done ) {
    generateSystemReportText(null, function (err, text) {
      if (err) {
        logger.error('Failed to aggregation for log reporting.', err);
        done();
      }
      else {
        var mailOptions = {
          to: config.admin.email,
          from: config.mailer.from,
          subject: 'Report mail: System Log Report ['+config.app.title+']',
          text: text,
        };
        smtpTransport.sendMail(mailOptions, function (err) {
          if (!err) {
            logger.info('An email has been sent to the provided email with further instructions.', {type: 'system'});
          } else {
            logger.error('Failure sending email', err);
          }

          done();
        });
      }
    });
  });
  // Crawl log reporting
  options.agenda.define('Reporting Crawl Logs', {concurrency: 1}, function ( job, done ) {
    generateCrawlReportText(null, function (err, text) {
      if (err) {
        logger.error('Failed to aggregation for log reporting.', err);
        done();
      }
      else {
        var mailOptions = {
          to: config.admin.email,
          from: config.mailer.from,
          subject: 'Report mail: Crawl Log Report ['+config.app.title+']',
          text: text,
        };
        smtpTransport.sendMail(mailOptions, function (err) {
          if (!err) {
            logger.info('An email has been sent to the provided email with further instructions.', {type: 'system'});
          } else {
            logger.error('Failure sending email', err);
          }
          done();
        });
      }
    });
  });

  options.agenda.on('complete:Reporting System Logs', function(job) {
    job.remove();
  });

  options.agenda.on('complete:Reporting Crawl Logs', function(job) {
    job.remove();
  });

  callback();
};

exports.start = function (options) {
  // Starting agenda jobs at start up if enable
  if (config.admin.systemReport.enable === true) {
    // system log
    if (!config.admin.systemReport.term) {
      options.agenda.now('Reporting System Logs');
    } else {
      options.agenda.every(config.admin.systemReport.term, 'Reporting System Logs');
    }
  }

  if (config.admin.crawlReport.enable === true) {
    // crawl log
    if (!config.admin.crawlReport.term) {
      options.agenda.now('Reporting Crawl Logs');
    } else {
      options.agenda.every(config.admin.crawlReport.term, 'Reporting Crawl Logs');
    }
  }
};


function generateSystemReportText (options, callback) {
  var text = '',
    startdate = new Date(new Date().getTime() - 259200000); // 1 week ranged

  try {
    // Error log report
    Log.aggregate([{
      $match: {
        level: "error",
        timestamp: {$gt: startdate}
      }
    }, {
      $group : {
        _id : {
          year: { $year : [{ $add: ["$timestamp", 32400000] }] },
          month: { $month : [{ $add: ["$timestamp", 32400000] }] },
          day: { $dayOfMonth : [{ $add: ["$timestamp", 32400000] }] },
          message: '$message'
        },
        count : {$sum: 1}
      }
    }, {
      $project : {
        date: {
          year: "$_id.year",
          month: "$_id.month",
          day: "$_id.day",
        },
        message: '$_id.message',
        count : '$count',
        _id: 0
      }
    }, {
      $sort: {'date.year': -1, 'date.month': -1, 'date.day': -1, 'message': 1}
    }], function (err, result) {
      if (err) {
        callback(err);
      } else {
        var row = [];
        row.push('****** Error logs ******\n');
        row.push('[Date - Message - Count]');
        if (result.length === 0) {
          row.push('No error found');
        }
        for (var i=0; i<result.length; i++) {
          row.push(result[i].date.year+'.'+result[i].date.month+'.'+result[i].date.day+' - '+result[i].message+' - '+result[i].count);
        }

        row.push('\n');
        row.push('- Wacwac P/F -');
        text += row.join('\n');
        callback(null, text);
      }
    });
  } catch (e) {
    callback(e, null);
  }
}

function generateCrawlReportText (options, callback) {
  var text = '',
    startdate = new Date(new Date().getTime() - 259200000); // 1 week ranged

  try {
  // "Crawl" log report
    Log.aggregate([{
      $match: {
        'meta.type': 'crawlResult',
        'meta.status': {
          $ne: 200
        },
        timestamp: {$gt: startdate}
      }
    }, {
      $group : {
        _id : {
          year: { $year : [{ $add: ["$timestamp", 32400000] }] },
          month: { $month : [{ $add: ["$timestamp", 32400000] }] },
          day: { $dayOfMonth : [{ $add: ["$timestamp", 32400000] }] },
          crawlerName : '$meta.crawlerName',
          message: '$message'
        },
        count : {$sum: 1}
      }
    }, {
      $project : {
        date: {
          year: "$_id.year",
          month: "$_id.month",
          day: "$_id.day"
        },
        crawlerName : '$_id.crawlerName',
        message: '$_id.message',
        count : '$count',
        _id: 0
      }
    }, {
      $sort: {'crawlerName': 1, 'date.year': -1, 'date.month': -1, 'date.day': -1, 'message': 1}
    }], function (err, result) {
      if (err) {
        callback(err);
      } else {
        var row = [];
        row.push('****** Crawl logs of each crawler ******\n');
        row.push('[Crawler Name - Date - Status - Count]');
        if (result.length === 0) {
          row.push('No logs found');
        }
        for (var i=0; i<result.length; i++) {
          row.push(result[i].crawlerName+' - '+result[i].date.year+'.'+result[i].date.month+'.'+result[i].date.day+' - '+result[i].message+' - '+result[i].count);
        }

        row.push('\n');
        row.push('- Wacwac P/F -');
        text += row.join('\n');
        callback(null, text);
     }
    });
  } catch (e) {
    callback(e, null);
  }
}