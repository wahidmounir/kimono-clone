'use strict';

//Logs service used for communicating with the logs REST endpoints
angular.module('logs').factory('Logs', ['$resource',
  function ($resource) {
    return $resource('api/logs/:logId', {
      logId: '@_id'
    }, {
      update: {
        method: 'PUT'
      }
    });
  }
]);
