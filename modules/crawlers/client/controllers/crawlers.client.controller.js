'use strict';

// Crawlers controller
angular.module('crawlers').controller('CrawlersController', ['$scope', '$window', '$http', '$stateParams', '$location', '$timeout', '$modal', 'Authentication', 'Crawlers', 'CrawlerStats', 'vcRecaptchaService',
  function ($scope, $window, $http, $stateParams, $location, $timeout, $modal, Authentication, Crawlers, CrawlerStats, vcRecaptchaService) {
    $scope.authentication = Authentication;
    
    $scope.strategy = {
      selected: null,
      options: [
        {id: 'source',    name: 'Source URL Only'},
        {id: 'manual',    name: 'Manual URL List'},
        {id: 'parameter', name: 'URL Parameter'},
        {id: 'api',       name: 'Use API'}
      ],
    };
    
    $scope.archive = {
      options: [
        {id: 'no',  name: 'Last crawl only'},
        {id: 'yes', name: 'Archive all crawls'},
      ],
    };
    
    $scope.frequency = {
      selected: null,
      options: [
        {id: 'manual',     name: 'Manual crawl'},
        {id: '30-seconds', name: 'Every 30 seconds (to test)'},
        {id: '1-hour',     name: 'Every hour'},
        {id: '3-hours',    name: 'Every 3 hours'},
        {id: '6-hours',    name: 'Every 6 hours'},
        {id: '12-hours',   name: 'Every 12 hours'},
        {id: '24-hours',   name: 'Every day'},
      ],
    };
    
    $scope.behavior = {
      options: [
        {id: 'default', name: 'Default'},
        {id: 'range',   name: 'Range'},
        {id: 'list',    name: 'List'}
      ],
    };
    
    $scope.forward = {
      options: [
        {id: 2,  name: '2 pages max (to test)'},
        {id: 5,  name: '5 pages max'},
        {id: 10, name: '10 pages max'},
        {id: 20, name: '20 pages max'}
      ],
    };
    
    // Create new Crawler
    $scope.create = function (isValid) {
      $scope.error = null;

      if (!isValid) {
        $scope.$broadcast('show-errors-check-validity', 'crawlerForm');
        return false;
      }
      
      // Spam block
      if (this.website !== undefined) {
        $scope.$broadcast('show-errors-check-validity', 'crawlerForm');
        $scope.error = 'Cannot create.';
        return false;
      }
      
     /**
      * SERVER SIDE VALIDATION
      *
      * You need to implement your server side validation here.
      * Send the reCaptcha response to the server and use some of the server side APIs to validate it
      * See https://developers.google.com/recaptcha/docs/verify
      */
      var valid;
      console.log('sending the captcha response to the server', $scope.response);
      if (valid) {
          console.log('Success');
      } else {
          console.log('Failed validation');
          // In case of a failed validation you need to reload the captcha
          // because each response can be checked just once
          vcRecaptchaService.reload($scope.widgetId);
      }
      
      // Create new Crawler object
      var crawler = new Crawlers.crud({
        name: this.name,
        url: this.url
      });
      
      // Redirect after save
      crawler.$save(function (response) {
        $location.path('crawlers/' + response._id);

        // Clear form fields
        $scope.name = '';
        $scope.url = '';
        $scope.status = '';
        $scope.strategy = '';
        $scope.frequency = '';
        $scope.basepath = '';
        $scope.forwarding = '';
        $scope.script = '';
      }, function (errorResponse) {
        $scope.error = errorResponse.data.message;
      });
    };

    // Remove existing Crawler
    $scope.remove = function (crawler) {
      if (crawler) {
        crawler.$remove();

        for (var i in $scope.crawlers) {
          if ($scope.crawlers[i] === crawler) {
            $scope.crawlers.splice(i, 1);
          }
        }
      } else {
        $scope.crawler.$remove(function () {
          $location.path('crawlers');
        });
      }
    };
    
    $scope.openDeleteConfirmationModal = function () {
      var modalInstance = $modal.open({
        animation: true,
        templateUrl: 'myModalContent.html',
        controller: 'ModalInstanceController',
        size: 'sm',
        resolve: {}
      });

      modalInstance.result.then(function () {
        $scope.remove();
      }, function () {
        // dismissed function below.
      });
    };

    // Update existing Crawler
    $scope.update = function (isValid) {
      $scope.error = null;

      if (!isValid) {
        $scope.$broadcast('show-errors-check-validity', 'crawlerForm');

        return false;
      }

      var crawler = $scope.crawler;
      
      crawler.$update(function () {
        $location.path('crawlers/' + crawler._id);
      }, function (errorResponse) {
        $scope.error = errorResponse.data.message;
      });
    };

    $scope.updateFilter = function () {
      var crawler = $scope.crawler;
      crawler.filter.source = $scope.editor.getValue();
      
      crawler.$update(function () {
        $scope.crawler = crawler;
        $scope.getCrawledRows();
      }, function (errorResponse) {
        $scope.error = errorResponse.data.message;
      });
    };

    // Find a list of Crawlers
    $scope.find = function () {
      $scope.crawlers = Crawlers.crud.query();
    };
    
    $scope.findByUser = function () {
      $scope.userCrawlers = Crawlers.list.query();
    };
    

    // Find existing Crawler
    $scope.findOne = function () {
      $scope.crawler = Crawlers.crud.get({
        crawlerId: $stateParams.crawlerId
      }, function () {
        if ($scope.editor) {
          $scope.editor.setValue($scope.crawler.filter.source);
        }
        
        // Sort the parameter by the sort number (ascending).
        if ($scope.crawler.strategy.content.parameter.length >= 1) {
          $scope.crawler.strategy.content.parameter.sort(function(a, b) {
            return (a.num < b.num) ? -1 : 1;
          });
        }
        
        // Parsing given url.
        // Generating full url is below.
        //  - protocol+'//'+host+port+pathname+search
        $scope.parser = document.createElement('a');
        $scope.parser.href = $scope.crawler.url;
        var pathnames = $scope.parser.pathname.substring(1).split('/');
        if (pathnames[0] === "") {pathnames = [];} 
        var queries = $scope.parser.search.substring(1).split('&');
        if (queries[0] === "") {queries = [];} 
        var test = function (element) {
          return element.param === this;
        };
        
        for (var i=0; i<pathnames.length; i++) {
          var pidx = $scope.crawler.strategy.content.parameter.findIndex(test, pathnames[i]);
          if (i !== pidx) {
            $scope.crawler.strategy.content.parameter[i] = {
              num: i,
              param: pathnames[i],
              paramtype: 'path',
              exp: '^()(.+)()$',
              behavior: 'default'
            };
          }
        }
        for (var q=0; q<queries.length; q++) {
          var qidx = $scope.crawler.strategy.content.parameter.findIndex(test, queries[q]);
          if (q+pathnames.length !== qidx) {
            $scope.crawler.strategy.content.parameter[q+pathnames.length] = {
              num: q+pathnames.length,
              param: queries[q],
              paramtype: 'query',
              exp: '^()(.+)()$',
              behavior: 'default'
            };
          }
        }
        var n=pathnames.length+queries.length;
        $scope.crawler.strategy.content.parameter = $scope.crawler.strategy.content.parameter.slice(0, n);
      });
    };
    
    $scope.getCrawledRows = function () {
      var url = "api/crawlers/";
      var params = { "Command": "GetCrawlerStats" };
      var data = { response: { }, calls: 0 };

      $http.get(url+$stateParams.crawlerId+'/data.json', params).then(function (responseData) {
        //data.response = responseData.data;
        //console.log(data.response);
        $scope.crawlData = responseData.data;
      });
    };
    
    $scope.prepareEditor = function () {
      $scope.editor = $window.ace.edit("editor");
      $scope.editor.getSession().setMode("ace/mode/javascript");
      $scope.editor.setOptions({
        maxLines: 20//Infinity
      });
    };
  
    // Display current status of Crawler
    
    
    /*$scope.reserve = function () {
      Crawlers.reserve.ready({
        crawlerId: $stateParams.crawlerId
      });
    };*/
    $scope.reserve = function () {
      Crawlers.reserve.ready({
        crawlerId: $stateParams.crawlerId
      });
      location.reload();
    };
    
    // exec
    $scope.now = function () {
      Crawlers.crawl.now({
        crawlerId: $stateParams.crawlerId
      });
      location.reload();
    };
    
    
    // Dinamically adding array.
    $scope.items = [];

    $scope.itemsToAdd = [{
      name: '',
      path: '',
      matches: {
        href: '',
        src: '',
        alt: '',
        content: '',
        text: ''
      },
      sort: ''
    }];
    
    $scope.add = function(itemToAdd) {
      var index = $scope.itemsToAdd.indexOf(itemToAdd);
      $scope.itemsToAdd.splice(index, 1);
      $scope.crawler.properties.push(angular.copy(itemToAdd));
    };
    
    $scope.addNew = function () {
      $scope.itemsToAdd.push({
        name: '',
        path: '',
        matches: {
          href: '',
          src: '',
          alt: '',
          content: '',
          text: ''
        },
        sort: ''
      });
    };

    $scope.delete = function(itemToDelete) {
      var index = $scope.crawler.properties.indexOf(itemToDelete);
      $scope.crawler.properties.splice(index, 1);
    };
    
    
    $scope.pollData = function() {
      if ($stateParams.crawlerId === undefined) {return false;}
      CrawlerStats.poll($stateParams.crawlerId).then(function(data) {
        $scope.data = data.response;
        $timeout($scope.pollData, 3000);
      });
    };
    
    /*// Socket Comm.
    if (!Socket.socket) {
      Socket.connect();
    }

    Socket.on('sendMessage', function (message) {
      $scope.message = message;
      Crawlers.reserve.ready({
        crawlerId: message.text
      });
    });

    $scope.sendMessage = function (crawlerId) {
      var message = {text:crawlerId};
      Socket.emit('sendMessage', message);
      location.reload();
    };

    $scope.$on('$destroy', function () {
      Socket.removeListener('sendMessage');
    });
    */
    
    $scope.response = null;
    $scope.widgetId = null;
    $scope.model = {
        key: '6Ld6mB0TAAAAAGI18s6tR_MeXQDzO3V1UGWWLF1C'
    };
    $scope.setResponse = function (response) {
        console.info('Response available');
        $scope.response = response;
    };
    $scope.setWidgetId = function (widgetId) {
        console.info('Created widget ID: %s', widgetId);
        $scope.widgetId = widgetId;
    };
    $scope.cbExpiration = function() {
        console.info('Captcha expired. Resetting response object');
        vcRecaptchaService.reload($scope.widgetId);
        $scope.response = null;
     };
  }
]);


angular.module('crawlers').controller('ModalInstanceController',  
  function ($scope, $modalInstance) {
    
    $scope.ok = function () {
      $modalInstance.close();
    };

    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };
  }
);
