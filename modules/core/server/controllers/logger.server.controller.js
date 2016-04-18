'use strict';

// Winston
// Winston-mongodb
//  - https://github.com/winstonjs/winston-mongodb
var winston = require('winston'),
  path = require('path'),
  config = require(path.resolve('config/config.js'));
require('winston-mongodb').MongoDB;

winston.add(winston.transports.MongoDB, {
  db: config.db.uri,
  options: config.db.options,
  collection: 'logs',
  capped: true
});

/*winston.add(
  require('winston-daily-rotate-file'), {
    name: 'info-file',
    datePattern: '.yyyy-MM-dd.log',
    filename: 'logs/filelog-info',
    level: 'info',
    json: true,
    eol: '\n',
    timestamp: true
  }
);

winston.add(
  require('winston-daily-rotate-file'), {
    name: 'error-file',
    datePattern: '.yyyy-MM-dd.log',
    filename: 'logs/filelog-error',
    level: 'error',
    json: true,
    eol: '\n',
    timestamp: true
  }
);*/

winston.remove(
  winston.transports.Console
);
winston.add(
  winston.transports.Console, {
    level: 'debug',
    colorize: true,
    prettyPrint: true
  }
);


exports.log = function (mess, level) {
  if (level === 'error') {
    winston.error(mess);
  } else if (level === 'warn') {
    winston.warn(mess);
  } else if (level === 'notice' || level === 'info') {
    winston.info(mess);
  } else if (level === 'debug') {
    winston.debug(mess);
  } else {
    winston.debug(mess);
  }
};

exports.error = function (mess, meta) {
  if (meta === undefined) {winston.error(mess);}
  else {winston.error(mess, meta);}
};

exports.warn = function (mess, meta) {
  if (meta === undefined) {winston.warn(mess);}
  else {winston.warn(mess, meta);}
};

exports.info = function (mess, meta) {
  if (meta === undefined) {winston.info(mess);}
  else {winston.info(mess, meta);}
};

exports.verbose = function (mess, meta) {
  if (meta === undefined) {winston.verbose(mess);}
  else {winston.verbose(mess, meta);}
};

exports.debug = function (mess, meta) {
  if (meta === undefined) {winston.debug(mess);}
  else {winston.debug(mess, meta);}
};

exports.silly = function (mess, meta) {
  if (meta === undefined) {winston.silly(mess);}
  else {winston.silly(mess, meta);}
};
