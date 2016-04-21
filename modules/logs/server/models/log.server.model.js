'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

/**
 * Log Schema
 */
var LogSchema = new Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  message: {
    type: String
  },
  level: {
    type: String
  },
  meta: {}
});

mongoose.model('Log', LogSchema);
