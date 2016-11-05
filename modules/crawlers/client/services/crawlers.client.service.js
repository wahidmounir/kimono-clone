'use strict';

//Crawlers service used for communicating with the crawlers REST endpoints
angular.module('crawlers').factory('Crawlers', ['$resource',
function ($resource) {
  return {
    crawl: 
      $resource('api/crawlers/:crawlerId/now', {
        crawlerId: '@_id'
      }, {
        now: {
          method: 'GET'
        }
      }),
    clear: 
      $resource('api/crawlers/:crawlerId/clear', {
        crawlerId: '@_id'
      }, {
        now: {
          method: 'GET'
        }
      }),
    reserve:
      $resource('api/crawlers/:crawlerId/reserve', {
        crawlerId: '@_id'
      }, {
        ready: {
          method: 'GET'
        }
      }),
    crud: 
      $resource('api/crawlers/:crawlerId', {
        crawlerId: '@_id'
      }, {
        update: {
          method: 'PUT'
        },
        save: {
          method:'POST',
          transformRequest: function(data, headers){
            headers = {'Content-Type': 'application/json'};
            var str = [];
            for(var p in data) {
              str.push(encodeURIComponent(p) + "=" + encodeURIComponent(data[p]));
            }
            return str.join("&");
          }
        },
        // search: {
        //   method: 'GET',
        //   params: {
        //     srchwd: '@srchwd',
        //   },
        //   isArray: true
        // }
      }),
      list: $resource('api/crawlers/user')
  };
}
]);

angular.module('crawlers').factory('CrawlerStats', function ($http, $timeout) {
    $http.defaults.headers.post["Content-Type"] = "application/x-www-form-urlencoded";

    var url = "api/crawlers/";
    var params = { "Command": "GetCrawlerStats" };
    var data = { response: { }, calls: 0 };

    var poller = function (id) {
      return $http.get(url+id+'/status', params).then(function (responseData) {
        data.calls++;
        data.response = responseData.data;
        return data;
      });
    };
    return {
        poll: poller
    };
});