'use strict';

/*var state = {
  values: 'none success failur'.split(' '),
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};*/

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
Schema = mongoose.Schema;

/**
 * Crawl Schema
 */
var CrawlSchema = new Schema({
  created: {
    type: Date,
    default: Date.now
  },
  updated: {
    type: Date,
    default: Date.now
  },
  record: [],
  crawler: {
    type: Schema.ObjectId,
    ref: 'Crawler'
  },
  user: {
    type: Schema.ObjectId,
    ref: 'User'
  }
});

mongoose.model('Crawl', CrawlSchema);

