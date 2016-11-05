'use strict';

angular.module('users').controller('AuthenticationController', ['$scope', '$state', '$http', '$location', '$window', 'Authentication', 'vcRecaptchaService',
  function ($scope, $state, $http, $location, $window, Authentication, vcRecaptchaService) {
    $scope.authentication = Authentication;

    // Get an eventual error defined in the URL query string:
    $scope.error = $location.search().err;

    // If user is signed in then redirect back home
    if ($scope.authentication.user) {
      $location.path('/');
    }

    $scope.signup = function (isValid) {
      $scope.error = null;

      if (!isValid) {
        $scope.$broadcast('show-errors-check-validity', 'userForm');

        return false;
      }

      $http.post('/api/recaptcha/verify', {
        'grresponse': $scope.response
      }).then(function (response) {
        if(response.data.error === 0){
          $http.post('/api/auth/signup', $scope.credentials).success(function (response) {
            // If successful we assign the response to the global user model
            $scope.authentication.user = response;

            // And redirect to the previous or home page
            $state.go($state.previous.state.name || 'home', $state.previous.params);
          }).error(function (response) {
            $scope.error = response.message;
          });
        } else {
          $scope.error = 'Failed validation';
          vcRecaptchaService.reload($scope.widgetId);
        }
      });
    };

    $scope.signin = function (isValid) {
      $scope.error = null;

      if (!isValid) {
        $scope.$broadcast('show-errors-check-validity', 'userForm');

        return false;
      }

      $http.post('/api/recaptcha/verify', {
        'grresponse': $scope.response
      }).then(function (response) {
        if(response.data.error === 0){
          $http.post('/api/auth/signin', $scope.credentials).success(function (response) {
            // If successful we assign the response to the global user model
            $scope.authentication.user = response;

            // And redirect to the previous or home page
            $state.go($state.previous.state.name || 'home', $state.previous.params);
          }).error(function (response) {
            $scope.error = response.message;
          });
        } else {
          $scope.error = 'Failed validation';
          vcRecaptchaService.reload($scope.widgetId);
        }
      });
    };

    // OAuth provider request
    $scope.callOauthProvider = function (url) {
      if ($state.previous && $state.previous.href) {
        url += '?redirect_to=' + encodeURIComponent($state.previous.href);
      }

      // Effectively call OAuth authentication route:
      $window.location.href = url;
    };

   /**
    * SERVER SIDE VALIDATION
    *
    * You need to implement your server side validation here.
    * Send the reCaptcha response to the server and use some of the server side APIs to validate it
    * See https://developers.google.com/recaptcha/docs/verify
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
