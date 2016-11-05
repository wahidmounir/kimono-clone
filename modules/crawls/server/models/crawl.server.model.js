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

// var state = {
//   values: 'none progress finished'.split(' '),
//   message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
// };


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
  // status: {
  //   type: String,
  //   enum: state,
  //   default: 'none',
  //   trim: true,
  //   required: 'Status cannot be blank'
  // },
  progress: {
    process: {
      type: Number,
      default: 0,
      trim: true
    },
    error: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0,
      trim: true
    }
  },
  columns: [{ // [TODO] いらない？
    type: String,
    trim: true
  }],
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

