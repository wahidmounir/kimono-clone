'use strict';

/**
 * Module dependencies.
 */
var acl = require('acl');

// Using the memory backend
acl = new acl(new acl.memoryBackend());

/**
 * Invoke Articles Permissions
 */
exports.invokeRolesPolicies = function () {
  acl.allow([{
    roles: ['admin'],
    allows: [{
      resources: '/api/crawlers',
      permissions: '*'
    }, {
      resources: '/api/crawlers/list/:page/:per',
      permissions: '*'
    }, {
      resources: '/api/crawlers/list/:page/:per/:srchwd',
      permissions: '*'
    }, {
      resources: '/api/crawlers/user',
      permissions: '*'
    }, {
      resources: '/api/crawlers/:crawlerId/reserve',
      permissions: '*'
    }, {
      resources: '/api/crawlers/:crawlerId/now',
      permissions: '*'
    }, {
      resources: '/api/crawlers/:crawlerId/status',
      permissions: '*'
    }, {
      resources: '/api/crawlers/:crawlerId/data',
      permissions: ['get']
    }, {
      resources: '/api/crawlers/:crawlerId',
      permissions: '*'
    }]
  }, {
    roles: ['user'],
    allows: [{
      resources: '/api/crawlers',
      permissions: ['get', 'post']
    }, {
      resources: '/api/crawlers/user',
      permissions: '*'
    }, {
      resources: '/api/crawlers/:crawlerId',
      permissions: ['get']
    }]
  // }, {
    // roles: ['guest'],
    // allows: [{
    // //   resources: '/api/crawlers',
    // //   permissions: ['get']
    // // }, {
    // //   resources: '/api/crawlers/:crawlerId',
    // //   permissions: ['get']
    // // }, {
    //   // resources: '/api/crawlers/:crawlerId/data',
    //   // permissions: ['get']
    // }]
  }]);
};

/**
 * Check If Articles Policy Allows
 */
exports.isAllowed = function (req, res, next) {
  var roles = (req.user) ? req.user.roles : ['guest'];

  // If an crawler is being processed and the current user created it then allow any manipulation
  if (req.crawler && req.user && req.crawler.user.id === req.user.id) {
    return next();
  }

  // Check for user roles
  acl.areAnyRolesAllowed(roles, req.route.path, req.method.toLowerCase(), function (err, isAllowed) {
    if (err) {
      // An authorization error occurred.
      return res.status(500).send('Unexpected authorization error');
    } else {
      if (isAllowed) {
        // Access granted! Invoke next middleware
        return next();
      } else {
        return res.status(403).json({
          message: 'User is not authorized'
        });
      }
    }
  });
};
