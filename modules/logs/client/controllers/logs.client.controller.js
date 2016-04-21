'use strict';

// Logs controller
angular.module('logs').controller('LogsController', ['$scope', '$http', '$stateParams', '$location', 'Authentication', 'Logs',
  function ($scope, $http, $stateParams, $location, Authentication, Logs) {
    $scope.authentication = Authentication;
    
    //Pagination
    $scope.currentPage = $stateParams.page || 1;
    $scope.itemsPerPage = $stateParams.per || 10;
    $scope.logLevel = $stateParams.level || "";
    
    $scope.setPage = function (pageNo) {
      $scope.currentPage = pageNo;
    };

    $scope.pageChanged = function () {
      $scope.getLogs();
    };
    
    $scope.getLogs = function () {
      $http.get('/api/logs/list/' + $scope.currentPage+'/'+$scope.itemsPerPage+'/'+$scope.logLevel).success(function (response) {
        $scope.totalItems = response.count;
        $scope.logs = response.logs;
        $scope.table = response.table;
      }).error(function (response) {
        $scope.error = response.message;
      });
    };
    
    $scope.whatClassIsIt = function (val) {
      if(val === "error") {return "bg-danger";}
      else {return "";}
    };
        
    // Find a list of Logs
    $scope.find = function () {
      $scope.logs = Logs.query();
    };

    // Find existing Log
    $scope.findOne = function () {
      $scope.log = Logs.get({
        logId: $stateParams.logId
      });
    };
  }
]);
