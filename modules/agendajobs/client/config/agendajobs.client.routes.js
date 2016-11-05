(function () {
  'use strict';

  angular
    .module('agendajobs')
    .config(routeConfig);

  routeConfig.$inject = ['$stateProvider'];

  function routeConfig($stateProvider) {
    $stateProvider
      .state('agendajobs', {
        abstract: true,
        url: '/agendajobs',
        template: '<ui-view/>'
      })
      .state('agendajobs.list', {
        url: '',
        templateUrl: 'modules/agendajobs/client/views/list-agendajobs.client.view.html',
        controller: 'AgendajobsListController',
        controllerAs: 'vm',
        data: {
          roles: ['admin'],
          pageTitle: 'Agendajobs List'
        }
      })
      // .state('agendajobs.create', {
      //   url: '/create',
      //   templateUrl: 'modules/agendajobs/client/views/form-agendajob.client.view.html',
      //   controller: 'AgendajobsController',
      //   controllerAs: 'vm',
      //   resolve: {
      //     agendajobResolve: newAgendajob
      //   },
      //   data: {
      //     roles: ['user', 'admin'],
      //     pageTitle : 'Agendajobs Create'
      //   }
      // })
      .state('agendajobs.edit', {
        url: '/:agendajobId/edit',
        templateUrl: 'modules/agendajobs/client/views/form-agendajob.client.view.html',
        controller: 'AgendajobsController',
        controllerAs: 'vm',
        resolve: {
          agendajobResolve: getAgendajob
        },
        data: {
          roles: ['admin'],
          pageTitle: 'Edit Agendajob {{ agendajobResolve.name }}'
        }
      })
      .state('agendajobs.view', {
        url: '/:agendajobId',
        templateUrl: 'modules/agendajobs/client/views/view-agendajob.client.view.html',
        controller: 'AgendajobsController',
        controllerAs: 'vm',
        resolve: {
          agendajobResolve: getAgendajob
        },
        data:{
          roles: ['admin'],
          pageTitle: 'Agendajob {{ articleResolve.name }}'
        }
      });
  }

  getAgendajob.$inject = ['$stateParams', 'AgendajobsService'];

  function getAgendajob($stateParams, AgendajobsService) {
    return AgendajobsService.get({
      agendajobId: $stateParams.agendajobId
    }).$promise;
  }

  newAgendajob.$inject = ['AgendajobsService'];

  function newAgendajob(AgendajobsService) {
    return new AgendajobsService();
  }
})();
