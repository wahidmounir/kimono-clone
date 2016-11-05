'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

/**
 * Idx Schema
 */
var IdxSchema = new Schema({
  created: {
    type: Date,
    default: Date.now
  },
  crawler: {
    type: Schema.ObjectId,
    ref: 'Crawler'
  },
  user: {
    type: Schema.ObjectId,
    ref: 'User'
  }
});

mongoose.model('Idx', IdxSchema);
