'use strict';

// Configuring the Crawlers module
angular.module('crawlers').run(['Menus',
  function (Menus) {
    // Add the crawlers dropdown item
    Menus.addMenuItem('topbar', {
      title: 'API',
      state: 'crawlers',
      type: 'dropdown',
      roles: ['admin', 'user']
    });

    // Add the dropdown list item
    Menus.addSubMenuItem('topbar', 'crawlers', {
      title: 'List API',
      state: 'crawlers.list',
      roles: ['admin', 'user']
    });

    // Add the dropdown create item
    Menus.addSubMenuItem('topbar', 'crawlers', {
      title: 'Create API',
      state: 'crawlers.create',
      roles: ['admin', 'user']
    });
  }
]);
