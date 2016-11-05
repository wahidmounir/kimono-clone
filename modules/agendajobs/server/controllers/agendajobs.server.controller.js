'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
  mongoose = require('mongoose'),
  Agendajob = mongoose.model('Agendajob'),
  agenda = require(path.resolve('./config/lib/agenda')),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
  _ = require('lodash');

/**
 * Create a Agendajob
 */
exports.create = function(req, res) {
  var agendajob = new Agendajob(req.body);
  agendajob.user = req.user;

  agendajob.save(function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.jsonp(agendajob);
    }
  });
};

/**
 * Show the current Agendajob
 */
exports.read = function(req, res) {
  // convert mongoose document to JSON
  var agendajob = req.agendajob ? req.agendajob.toJSON() : {};

  // Add a custom field to the Article, for determining if the current User is the "owner".
  // NOTE: This field is NOT persisted to the database, since it doesn't exist in the Article model.
  agendajob.isCurrentUserOwner = req.user && agendajob.user && agendajob.user._id.toString() === req.user._id.toString() ? true : false;

  res.jsonp(agendajob);
};

/**
 * Update a Agendajob
 */
exports.update = function(req, res) {
  var agendajob = req.agendajob ;

  agendajob = _.extend(agendajob , req.body);

  agendajob.save(function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.jsonp(agendajob);
    }
  });
};

/**
 * Delete an Agendajob
 */
exports.delete = function(req, res) {
  var agendajob = req.agendajob ;

  agendajob.remove(function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.jsonp(agendajob);
    }
  });
};

/**
 * List of Agendajobs
 */
exports.list = function(req, res) { 
  Agendajob.find().sort('-created').populate('user', 'displayName').exec(function(err, agendajobs) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.jsonp(agendajobs);
    }
  });
};

/**
 * Agendajob middleware
 */
exports.agendajobByID = function(req, res, next, id) {

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({
      message: 'Agendajob is invalid'
    });
  }

  Agendajob.findById(id).populate('user', 'displayName').exec(function (err, agendajob) {
    if (err) {
      return next(err);
    } else if (!agendajob) {
      return res.status(404).send({
        message: 'No Agendajob with that identifier has been found'
      });
    }
    req.agendajob = agendajob;
    next();
  });
};



exports.touch = function(req, res) {
  agenda.jobs({_id: req.agendajob._id}, function(err, jobs) {
    for (var i=0; i<jobs.length; i++) {
      console.log('---------- Touched ('+JSON.stringify(jobs[i])+') -----------');
      jobs[i].touch();
    }
  });
};

exports.comm = function(req, res) {
  switch (req.body.action) {
    case 'agenda-start':
      console.log('---------- agenda-start -----------');
      agenda.start();
      break;
    case 'agenda-stop':
      console.log('---------- agenda-stop -----------');
      agenda.stop();
      break;
  }
};
