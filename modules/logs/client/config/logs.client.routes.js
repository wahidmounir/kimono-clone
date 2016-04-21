'use strict';

// Setting up route
angular.module('logs').config(['$stateProvider',
  function ($stateProvider) {
    // Logs state routing
    $stateProvider
      .state('logs', {
        abstract: true,
        url: '/logs',
        template: '<ui-view/>'
      })
      .state('logs.listConditionNone', {
        url: '',
        templateUrl: 'modules/logs/client/views/list-logs.client.view.html',
        data: {
          roles: ['admin']
        }
      })
      .state('logs.list', {
        url: '/:level/:page/:per',
        templateUrl: 'modules/logs/client/views/list-logs.client.view.html',
        data: {
          roles: ['admin']
        }
      })
      .state('logs.view', {
        url: '/:logId',
        templateUrl: 'modules/logs/client/views/view-log.client.view.html'
      });
  }
]);
