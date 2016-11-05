//Idxes service used to communicate Idxes REST endpoints
(function () {
  'use strict';

  angular
    .module('idxes')
    .factory('IdxesService', IdxesService);

  IdxesService.$inject = ['$resource'];

  function IdxesService($resource) {
    return $resource('api/idxes/:idxId', {
      idxId: '@_id'
    }, {
      update: {
        method: 'PUT'
      }
    });
  }
})();
