(function () {
  'use strict';

  angular
    .module('agendajobs')
    .controller('AgendajobsListController', AgendajobsListController);

  AgendajobsListController.$inject = ['$state', 'AgendajobsService'];

  function AgendajobsListController($state, AgendajobsService) {
    var vm = this;

    vm.agendajobs = AgendajobsService.query();
    vm.remove = remove;
    vm.touch = touch;
    vm.comm = comm;

    // Remove existing Agendajob
    function remove(agendajob) {
      if (confirm('Are you sure you want to delete?')) {
        agendajob.$remove($state.go('agendajobs.list'));
      }
    }

    function touch(agendajob) {
      if (confirm('Are you sure you want to touch (unlock) ?')) {
        agendajob.$touch($state.go('agendajobs.list'));
      }
    }

    function comm(action) {
      AgendajobsService.comm({
        action: action
      });
    }
  }
})();
