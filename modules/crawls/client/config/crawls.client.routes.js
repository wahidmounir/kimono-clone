'use strict';

// Setting up route
angular.module('crawls').config(['$stateProvider',
  function ($stateProvider) {
    // Crawls state routing
    $stateProvider
      .state('crawls', {
        abstract: true,
        url: '/crawls',
        template: '<ui-view/>'
      })
      .state('crawls.list', {
        url: '',
        templateUrl: 'modules/crawls/client/views/list-crawls.client.view.html'
      })
      .state('crawls.exec', {
        url: '/:crawlId/exec',
        templateUrl: 'modules/crawls/client/views/exec-crawls.client.view.html'
      })
      .state('crawls.create', {
        url: '/create',
        templateUrl: 'modules/crawls/client/views/create-crawl.client.view.html',
        data: {
          roles: ['user', 'admin']
        }
      })
      .state('crawls.view', {
        url: '/:crawlId',
        templateUrl: 'modules/crawls/client/views/view-crawl.client.view.html'
      })
      .state('crawls.log', {
        url: '/:crawlId/log',
        templateUrl: 'modules/crawls/client/views/log-crawl.client.view.html'
      });
      /*.state('crawls.edit', {
        url: '/:crawlId/edit',
        templateUrl: 'modules/crawls/client/views/edit-crawl.client.view.html',
        data: {
          roles: ['user', 'admin']
        }
      });*/
  }
]);
