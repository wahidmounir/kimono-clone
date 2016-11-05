'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

/**
 * Agendajob Schema
 */
var AgendajobSchema = new Schema({
  name: {
    type: String,
    default: '',
    required: 'Please fill Agendajob name',
    trim: true
  },
  created: {
    type: Date,
    default: Date.now
  },
  user: {
    type: Schema.ObjectId,
    ref: 'User'
  }
});

mongoose.model('Agendajob', AgendajobSchema);
