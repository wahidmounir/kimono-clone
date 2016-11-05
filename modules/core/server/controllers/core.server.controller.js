'use strict';

var path = require('path'),
    config = require(path.resolve('./config/config')),
    request = require('request');

/**
 * Render the main application page
 */
exports.renderIndex = function (req, res) {
  res.render('modules/core/server/views/index', {
    user: req.user || null
  });
};

/**
 * Render the server error page
 */
exports.renderServerError = function (req, res) {
  res.status(500).render('modules/core/server/views/500', {
    error: 'Oops! Something went wrong...'
  });
};

/**
 * Render the server not found responses
 * Performs content-negotiation on the Accept HTTP header
 */
exports.renderNotFound = function (req, res) {

  res.status(404).format({
    'text/html': function () {
      res.render('modules/core/server/views/404', {
        url: req.originalUrl
      });
    },
    'application/json': function () {
      res.json({
        error: 'Path not found'
      });
    },
    'default': function () {
      res.send('Path not found');
    }
  });
};


exports.verifyRecaptcha = function (req, res) {
  var postdata = {
    'secret': config.recaptcha.secret,
    'response': req.body.grresponse
  };
  
  request.post({url:'https://www.google.com/recaptcha/api/siteverify', form: postdata}, function(err,httpResponse,body){
    if (body.success === false) {
      res.json({
        error: 7,
        message: body['error-codes'].join('\n')
      });
    } else {
      res.json({
        error: 0,
        message: 'Successfully verifyied'
      });
    }
  });
};
