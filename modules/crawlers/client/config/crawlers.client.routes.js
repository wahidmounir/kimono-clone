'use strict';

// Setting up route
angular.module('crawlers').config(['$stateProvider',
  function ($stateProvider) {
    // Crawlers state routing
    $stateProvider
      .state('crawlers', {
        abstract: true,
        url: '/crawlers',
        template: '<ui-view/>'
      })
      .state('crawlers.list', {
        url: '',
        templateUrl: 'modules/crawlers/client/views/list-crawlers.client.view.html'
      })
      .state('crawlers.reserve', {
        url: '/:crawlerId/reserve',
        templateUrl: 'modules/crawlers/client/views/reserve-crawlers.client.view.html'
      })
      .state('crawlers.exec', {
        url: '/:crawlerId/exec',
        templateUrl: 'modules/crawlers/client/views/exec-crawlers.client.view.html'
      })
      .state('crawlers.create', {
        url: '/create',
        templateUrl: 'modules/crawlers/client/views/create-crawler.client.view.html',
        data: {
          roles: ['user', 'admin']
        }
      })
      .state('crawlers.view', {
        url: '/:crawlerId',
        templateUrl: 'modules/crawlers/client/views/view-crawler.client.view.html'
      })
      .state('crawlers.edit', {
        url: '/:crawlerId/edit',
        templateUrl: 'modules/crawlers/client/views/edit-crawler.client.view.html',
        data: {
          roles: ['user', 'admin']
        }
      });
  }
]);
