//Agendajobs service used to communicate Agendajobs REST endpoints
(function () {
  'use strict';

  angular
    .module('agendajobs')
    .factory('AgendajobsService', AgendajobsService);

  AgendajobsService.$inject = ['$resource'];

  function AgendajobsService($resource) {
    return $resource('api/agendajobs/:agendajobId', {
      agendajobId: '@_id'
    }, {
      update: {
        method: 'PUT'
      },
      touch: {
        method: 'POST'
      },
      comm: {
        method: 'POST',
        params: {
          action: '@action'
        }
      }
    });
  }
})();
