'use strict';

//Crawls service used for communicating with the crawls REST endpoints
angular.module('crawls').factory('Crawls', ['$resource',
  /*function ($resource) {
    return $resource('api/crawls/:crawlId', {
      crawlId: '@_id'
    }, {
      update: {
        method: 'PUT'
      }
    });
  }*/
  function ($resource) {
    return {
      crawl: 
        $resource('api/crawls/:crawlId', {
          crawlId: '@_id'
        }, {
          update: {
            method: 'PUT'
          }
        }),
      log: 
        $resource('api/logs/crawl/:crawlId', {
          crawlId: '@_id'
        }, {})
    };
  }
]);
