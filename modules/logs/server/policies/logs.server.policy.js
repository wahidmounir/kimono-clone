'use strict';

/**
 * Module dependencies.
 */
var acl = require('acl');

// Using the memory backend
acl = new acl(new acl.memoryBackend());

/**
 * Invoke Logs Permissions
 */
exports.invokeRolesPolicies = function () {
  acl.allow([{
    roles: ['admin'],
    allows: [{
      resources: [
        '/api/logs', 
        '/api/logs/:logId', 
        '/api/logs/list/:page/:per/',
        '/api/logs/list/:page/:per/:level',
        '/api/logs/crawl/:crawlId'
      ],
      permissions: '*'
    }]
  // }, {
  //   roles: ['user'],
  //   allows: [{
  //     resources: '/api/logs/crawl/:crawlId',
  //     permissions: ['get']
  //   }]
  // }, {
  //   roles: ['guest'],
  //   allows: []
  }]);
};

/**
 * Check If Logs Policy Allows
 */
exports.isAllowed = function (req, res, next) {
  var roles = (req.user) ? req.user.roles : ['guest'];

  // If an log is being processed and the current user created it then allow any manipulation
  if (req.log && req.user && req.log.user.id === req.user.id) {
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
