(function () {
  'use strict';

  // Idxes controller
  angular
    .module('idxes')
    .controller('IdxesController', IdxesController);

  IdxesController.$inject = ['$scope', '$state', 'Authentication', 'idxResolve'];

  function IdxesController ($scope, $state, Authentication, idx) {
    var vm = this;

    vm.authentication = Authentication;
    vm.idx = idx;
    vm.error = null;
    vm.form = {};
    vm.remove = remove;
    vm.save = save;

    // Remove existing Idx
    function remove() {
      if (confirm('Are you sure you want to delete?')) {
        vm.idx.$remove($state.go('idxes.list'));
      }
    }

    // Save Idx
    function save(isValid) {
      if (!isValid) {
        $scope.$broadcast('show-errors-check-validity', 'vm.form.idxForm');
        return false;
      }

      // TODO: move create/update logic to service
      if (vm.idx._id) {
        vm.idx.$update(successCallback, errorCallback);
      } else {
        vm.idx.$save(successCallback, errorCallback);
      }

      function successCallback(res) {
        $state.go('idxes.view', {
          idxId: res._id
        });
      }

      function errorCallback(res) {
        vm.error = res.data.message;
      }
    }
  }
})();
