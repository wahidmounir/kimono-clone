(function () {
  'use strict';

  // Agendajobs controller
  angular
    .module('agendajobs')
    .controller('AgendajobsController', AgendajobsController);

  AgendajobsController.$inject = ['$scope', '$state', 'Authentication', 'agendajobResolve'];

  function AgendajobsController ($scope, $state, Authentication, agendajob) {
    var vm = this;

    vm.authentication = Authentication;
    vm.agendajob = agendajob;
    vm.error = null;
    vm.form = {};
    vm.remove = remove;
    vm.save = save;

    // Remove existing Agendajob
    function remove(agendajob) {
      if (confirm('Are you sure you want to delete?')) {
        if (agendajob) {
          console.log(agendajob);
          agendajob.$remove($state.go('agendajobs.list'));
        } else {
          vm.agendajob.$remove($state.go('agendajobs.list'));
        }
      }
    }

    // Save Agendajob
    function save(isValid) {
      if (!isValid) {
        $scope.$broadcast('show-errors-check-validity', 'vm.form.agendajobForm');
        return false;
      }

      // TODO: move create/update logic to service
      if (vm.agendajob._id) {
        vm.agendajob.$update(successCallback, errorCallback);
      } else {
        vm.agendajob.$save(successCallback, errorCallback);
      }

      function successCallback(res) {
        $state.go('agendajobs.view', {
          agendajobId: res._id
        });
      }

      function errorCallback(res) {
        vm.error = res.data.message;
      }
    }
  }
})();
