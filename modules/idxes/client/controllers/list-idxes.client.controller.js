(function () {
  'use strict';

  angular
    .module('idxes')
    .controller('IdxesListController', IdxesListController);

  IdxesListController.$inject = ['IdxesService'];

  function IdxesListController(IdxesService) {
    var vm = this;

    vm.idxes = IdxesService.query();
  }
})();
