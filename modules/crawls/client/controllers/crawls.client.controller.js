'use strict';

// Crawls controller
angular.module('crawls').controller('CrawlsController', ['$scope', '$controller', '$stateParams', '$location', '$modal', 'Authentication', 'Crawls',
  function ($scope, $controller, $stateParams, $location, $modal, Authentication, Crawls) {
    $scope.authentication = Authentication;

    angular.module('crawlers').controller('CrawlersController', ['$scope', 
      function ($scopeCrawler) {
        $scope.crawlers = $scopeCrawler.crawlers;
      }
    ]);
      
    // Create new Crawl
    $scope.create = function (isValid) {
      $scope.error = null;

      if (!isValid) {
        $scope.$broadcast('show-errors-check-validity', 'crawlForm');

        return false;
      }

      // Create new Crawl object
      var crawl = new Crawls.crawl({
        name: this.name,
        url: this.url,
        status: this.status,
        strategy: this.strategy,
        frequency: this.frequency,
        archive: this.archive || 'no'
      });

      // Redirect after save
      crawl.$save(function (response) {
        $location.path('crawls/' + response._id);

        // Clear form fields
        $scope.name = '';
        $scope.url = '';
        $scope.status = '';
        $scope.strategy = '';
        $scope.frequency = '';
        $scope.archive = 'no';
      }, function (errorResponse) {
        $scope.error = errorResponse.data.message;
      });
    };

    // Remove existing Crawl
    $scope.remove = function (crawl) {
      if (crawl) {
        crawl.$remove();

        for (var i in $scope.crawls) {
          if ($scope.crawls[i] === crawl) {
            $scope.crawls.splice(i, 1);
          }
        }
      } else {
        $scope.crawl.$remove(function () {
          //$location.path('crawls');
          $location.path('crawlers/'+$scope.crawl.crawler._id);
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
    
    // Update existing Crawl
    $scope.update = function (isValid) {
      $scope.error = null;

      if (!isValid) {
        $scope.$broadcast('show-errors-check-validity', 'crawlForm');

        return false;
      }

      var crawl = $scope.crawl;

      crawl.$update(function () {
        $location.path('crawls/' + crawl._id);
      }, function (errorResponse) {
        $scope.error = errorResponse.data.message;
      });
    };

    // Find a list of Crawls
    $scope.find = function () {
      $scope.crawls = Crawls.crawl.query();
    };

    // Find existing Crawl
    $scope.findOne = function () {
      var crawl = Crawls.crawl.get({
        crawlId: $stateParams.crawlId
      });
      $scope.crawl = crawl;
    };
    
    $scope.findLogs = function () {
      $scope.logs = Crawls.log.get({
        crawlId: $stateParams.crawlId
      });
    };
    
    $scope.currentPage = 1;
    $scope.currentPageLog = 1;
    $scope.itemsPerPage = 10;

    $scope.getContent = function (row, col) {
      for (var r=0; r<row.length; r++) {
        if (row[r].name === col) {
          return row[r].content;
        }
      }
    };
  }
]);

angular.module('crawls').filter('offset', function () {
  return function(input, start) {
    if (input !== undefined) {
      return input.slice(start);
    }
  };
});

angular.module('crawls').controller('ModalInstanceController',  
  function ($scope, $modalInstance) {
    
    $scope.ok = function () {
      $modalInstance.close();
    };

    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };
  }
);
