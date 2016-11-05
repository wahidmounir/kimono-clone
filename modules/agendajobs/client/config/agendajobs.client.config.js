(function () {
  'use strict';

  angular
    .module('agendajobs')
    .run(menuConfig);

  menuConfig.$inject = ['Menus'];

  function menuConfig(Menus) {
    // Set top bar menu items
    Menus.addMenuItem('topbar', {
      title: 'Agendajobs',
      state: 'agendajobs.list',
      roles: ['admin']
    });
  }
})();
