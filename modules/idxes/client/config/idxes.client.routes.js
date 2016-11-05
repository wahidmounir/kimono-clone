(function () {
  'use strict';

  angular
    .module('idxes')
    .config(routeConfig);

  routeConfig.$inject = ['$stateProvider'];

  function routeConfig($stateProvider) {
    $stateProvider
      .state('idxes', {
        abstract: true,
        url: '/idxes',
        template: '<ui-view/>'
      })
      .state('idxes.list', {
        url: '',
        templateUrl: 'modules/idxes/client/views/list-idxes.client.view.html',
        controller: 'IdxesListController',
        controllerAs: 'vm',
        data: {
          pageTitle: 'Idxes List'
        }
      })
      .state('idxes.create', {
        url: '/create',
        templateUrl: 'modules/idxes/client/views/form-idx.client.view.html',
        controller: 'IdxesController',
        controllerAs: 'vm',
        resolve: {
          idxResolve: newIdx
        },
        data: {
          roles: ['user', 'admin'],
          pageTitle : 'Idxes Create'
        }
      })
      .state('idxes.edit', {
        url: '/:idxId/edit',
        templateUrl: 'modules/idxes/client/views/form-idx.client.view.html',
        controller: 'IdxesController',
        controllerAs: 'vm',
        resolve: {
          idxResolve: getIdx
        },
        data: {
          roles: ['user', 'admin'],
          pageTitle: 'Edit Idx {{ idxResolve.name }}'
        }
      })
      .state('idxes.view', {
        url: '/:idxId',
        templateUrl: 'modules/idxes/client/views/view-idx.client.view.html',
        controller: 'IdxesController',
        controllerAs: 'vm',
        resolve: {
          idxResolve: getIdx
        },
        data:{
          pageTitle: 'Idx {{ articleResolve.name }}'
        }
      });
  }

  getIdx.$inject = ['$stateParams', 'IdxesService'];

  function getIdx($stateParams, IdxesService) {
    return IdxesService.get({
      idxId: $stateParams.idxId
    }).$promise;
  }

  newIdx.$inject = ['IdxesService'];

  function newIdx(IdxesService) {
    return new IdxesService();
  }
})();
