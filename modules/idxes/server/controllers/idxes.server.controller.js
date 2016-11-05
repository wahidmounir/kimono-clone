'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
  mongoose = require('mongoose'),
  Idx = mongoose.model('Idx'),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
  _ = require('lodash');

/**
 * Create a Idx
 */
exports.create = function(req, res) {
  var idx = new Idx(req.body);
  idx.user = req.user;

  idx.save(function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.jsonp(idx);
    }
  });
};

/**
 * Show the current Idx
 */
exports.read = function(req, res) {
  // convert mongoose document to JSON
  var idx = req.idx ? req.idx.toJSON() : {};

  // Add a custom field to the Article, for determining if the current User is the "owner".
  // NOTE: This field is NOT persisted to the database, since it doesn't exist in the Article model.
  idx.isCurrentUserOwner = req.user && idx.user && idx.user._id.toString() === req.user._id.toString() ? true : false;

  res.jsonp(idx);
};

/**
 * Update a Idx
 */
exports.update = function(req, res) {
  var idx = req.idx ;

  idx = _.extend(idx , req.body);

  idx.save(function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.jsonp(idx);
    }
  });
};

/**
 * Delete an Idx
 */
exports.delete = function(req, res) {
  var idx = req.idx ;

  idx.remove(function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.jsonp(idx);
    }
  });
};

/**
 * List of Idxes
 */
exports.list = function(req, res) { 
  Idx.find().sort('-created').populate('user', 'displayName').exec(function(err, idxes) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.jsonp(idxes);
    }
  });
};

/**
 * Idx middleware
 */
exports.idxByID = function(req, res, next, id) {

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({
      message: 'Idx is invalid'
    });
  }

  Idx.findById(id).populate('user', 'displayName').exec(function (err, idx) {
    if (err) {
      return next(err);
    } else if (!idx) {
      return res.status(404).send({
        message: 'No Idx with that identifier has been found'
      });
    }
    req.idx = idx;
    next();
  });
};


/**
 * Create a Index from controller
 */
exports.ready = function (args, callback) {
  var idx = new Idx({
    crawler: args.crawler,
    user: args.crawler.user
  });
  
  idx.save(function (err) {
    if (err) {
      callback(err);
    }
    callback(idx);
  });
};
