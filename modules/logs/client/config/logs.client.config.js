'use strict';

// Configuring the Logs module
angular.module('logs').run(['Menus',
  function (Menus) {
    // Add the logs dropdown item
    Menus.addMenuItem('topbar', {
      title: 'Logs',
      state: 'logs.list',
      roles: ['admin']
    });
  }
]);
