'use strict';

/**
 * Module dependencies.
 */
var config = require('../config'),
  chalk = require('chalk'),
  path = require('path'),
  logger = require(path.resolve('./modules/core/server/controllers/logger.server.controller')),
  Agenda = require('agenda'),
  kimobs = require('./kim-observer');


var agenda = new Agenda({
  db: {
    address: config.db.uri,
    collection: config.agenda.collection
  },
  processEvery: config.agenda.processEvery});

agenda.on('ready', function() {
  var options = {
    agenda: agenda
  };

  // Start observing tasks

  //  - Email reporting
  kimobs.prepare(options, function () {
    kimobs.start(options, function (err) {
      if (err) {
        logger.error('Failure starting KimObserver', {type:'system', error:err});
      }
    });

    agenda.start();
  });
});

function graceful() {
  agenda.stop(function() {
    process.exit(0);
  });
}

process.on('SIGTERM', graceful);
process.on('SIGINT' , graceful);

module.exports = agenda;

