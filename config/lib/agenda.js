'use strict';

/**
 * Module dependencies.
 */
var config = require('../config'),
  chalk = require('chalk'),
  path = require('path'),
  Agenda = require('agenda');


var agenda = new Agenda({
  db: {
    address: config.db.uri
  },
  processEvery: '1 seconds'});

agenda.on('ready', function() {
  agenda.start();
});

module.exports = agenda;
