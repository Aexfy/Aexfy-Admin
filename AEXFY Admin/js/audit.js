// js/audit.js

(function(N) {
  'use strict';

  if (!N) return;

  var audit = N.audit = N.audit || {};
  var VIEW_ID = 'auditoria';
  var ui = {};
  var saveDebounced = N.utils.debounce(function() {
    if (N.data && N.data.saveState) {
      N.data.saveState({ silent: true });
    }
  }, 1200);

  function getLog() {
    N.state.meta.auditLog = N.state.meta.auditLog || [];
    return N.state.meta.auditLog;
  }

  audit.log = function(action, payload) {
    var session = N.state.session;
    var actor = session && session.user ? session.user.email : 'system';

    var entry = {
      id: N.utils.uid('audit'),
      action: action || 'unknown',
      actor: actor,
      payload: payload || {},
      created_at: N.utils.nowISO()
    };

    getLog().unshift(entry);
    saveDebounced();
  };

  function render(dataToRender) {
    if (!ui.container) return;
    N.ui.setViewTitle('Auditoria');
    N.ui.setActiveNav(VIEW_ID);

    var list = Array.isArray(dataToRender) ? dataToRender : getLog();

    var columns = [
      { key: 'created_at', label: 'Fecha' },
      { key: 'action', label: 'Accion' },
      { key: 'actor', label: 'Actor' },
      { key: 'payload', label: 'Detalle', formatter: function(value) {
        var content = value ? JSON.stringify(value) : '-';
        return '<span class="mono">' + N.utils.escapeHtml(content) + '</span>';
      } }
    ];

    N.ui.renderTable('#audit-list', columns, list, {
      emptyState: {
        title: 'Sin actividad',
        message: 'Las acciones del panel apareceran aqui.'
      }
    });
  }

  function handleSearch(event) {
    var term = event.target.value.trim().toLowerCase();
    if (!term) {
      render();
      return;
    }

    var filtered = getLog().filter(function(entry) {
      var action = (entry.action || '').toLowerCase();
      var actor = (entry.actor || '').toLowerCase();
      var payload = entry.payload ? JSON.stringify(entry.payload).toLowerCase() : '';
      return action.indexOf(term) >= 0 || actor.indexOf(term) >= 0 || payload.indexOf(term) >= 0;
    });

    render(filtered);
  }

  audit.init = function() {
    ui = {
      container: N.utils.$('#auditoria-content'),
      list: N.utils.$('#audit-list'),
      search: N.utils.$('#audit-search')
    };

    if (!ui.container) return;

    if (ui.search) {
      ui.search.addEventListener('input', N.utils.debounce(handleSearch, 300));
    }

    document.addEventListener('state:updated', function() {
      render();
    });
  };

  audit.render = render;
})(window.Aexfy);

