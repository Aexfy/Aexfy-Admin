// js/app.js
// App bootstrap and module orchestration.

(function(N) {
  'use strict';

  if (!N) return;

  var app = N.app = {};
  var modulesInitialized = false;

  var MODULES = [
    'ui',
    'password',
    'companies',
    'users',
    'staff',
    'modules',
    'subscription',
    'support',
    'analytics',
    'audit',
    'vendedor',
    'dte'
  ];

  function logDebug(message, detail) {
    if (!N.config || !N.config.DEBUG_LOGS) return;
    if (detail !== undefined) {
      console.warn(message, detail);
      return;
    }
    console.warn(message);
  }

  function initializeModules() {
    if (modulesInitialized) return;

    MODULES.forEach(function(name) {
      var mod = N[name];
      if (!mod) return;
      if (typeof mod.init === 'function') {
        try {
          mod.init();
        } catch (err) {
          logDebug('Module init failed:', name);
        }
      }
    });

    renderModules();

    modulesInitialized = true;
    if (document.body) {
      document.body.classList.add('is-ready');
    }
  }

  function renderModules() {
    MODULES.forEach(function(name) {
      var mod = N[name];
      if (!mod) return;
      if (typeof mod.render === 'function') {
        try {
          mod.render();
        } catch (err) {
          logDebug('Module render failed:', name);
        }
      }
    });
  }

  app.init = function() {
    if (N.auth && typeof N.auth.init === 'function') {
      N.auth.init();
    } else {
      logDebug('Auth module missing.');
    }
    if (!N.data) {
      logDebug('Data module missing.');
    }
    initializeModules();
    if (N.notifications && typeof N.notifications.init === 'function') {
      N.notifications.init();
    }
    if (N.data && typeof N.data.bootstrapState === 'function') {
      N.data.bootstrapState({ cacheOnly: true });
    }
      document.addEventListener('state:updated', function() {
        initializeModules();
        if (N.notifications && typeof N.notifications.render === 'function') {
          N.notifications.render();
        }
      });
  };

  app.refreshModules = function() {
    renderModules();
  };

  document.addEventListener('DOMContentLoaded', app.init);
})(window.Aexfy);

