// js/dte.js

(function(N) {
  'use strict';

  if (!N) return;

  var dte = N.dte = {};
  var VIEW_ID = 'dte';
  var ui = {};

  function canManage() {
    var level = N.state.session && N.state.session.accessLevel;
    return level === 'owner' || level === 'manager' || level === 'supervisor';
  }

  function getLog() {
    if (!N.state.meta.dteLog) {
      N.state.meta.dteLog = [];
    }
    return N.state.meta.dteLog;
  }

  function getVisibleCompanies() {
    return N.utils.filterCompaniesByAccess(N.state.companies || []);
  }

  function getVisibleLog() {
    var log = getLog();
    if (!N.utils.isZoneRestrictedSession()) return log;
    var allowed = {};
    getVisibleCompanies().forEach(function(company) {
      allowed[company.id] = true;
    });
    return log.filter(function(item) {
      return item && allowed[item.company_id];
    });
  }

  function openDteModal(item) {
    var isEditing = !!item;
    var template = N.utils.$('#dte-form-template');
    if (!template) return;

    var fragment = template.content.cloneNode(true);
    var form = fragment.querySelector('#dte-form');
    if (!form) return;

    var companySelect = form.querySelector('[name="company_id"]');
    if (companySelect) {
      companySelect.innerHTML = getVisibleCompanies().map(function(company, index) {
        var label = company.name || company.id;
        var code = company.company_code || ('C-' + String(index + 1).padStart(3, '0'));
        if (code) {
          label += ' (' + code + ')';
        }
        return '<option value="' + company.id + '">' + N.utils.escapeHtml(label) + '</option>';
      }).join('');
    }

    if (isEditing) {
      form.querySelector('[name="id"]').value = item.id || '';
      form.querySelector('[name="company_id"]').value = item.company_id || '';
      form.querySelector('[name="folio"]').value = item.folio || '';
      form.querySelector('[name="status"]').value = item.status || 'pending';
      form.querySelector('[name="total"]').value = item.total || '';
      form.querySelector('[name="notes"]').value = item.notes || '';
    }

    var footer =
      '<div class="btn-group">' +
        '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
        '<button type="submit" form="dte-form" class="btn btn-primary">Guardar</button>' +
      '</div>';

    var overlay = N.ui.showModal(isEditing ? 'Editar DTE' : 'Nuevo DTE', form.outerHTML, footer);
    if (!overlay) return;

    var modalForm = N.utils.$('#dte-form');
    if (modalForm) modalForm.addEventListener('submit', handleFormSubmit);

    var closeBtn = N.utils.$('[data-modal-close]', overlay);
    if (closeBtn) closeBtn.addEventListener('click', function() { N.ui.closeModal(); });
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    var form = event.target;
    if (form.checkValidity && !form.checkValidity()) {
      form.reportValidity();
      return;
    }
    var unlock = N.utils.lockForm(form);
    if (!unlock) return;
    try {
      var data = Object.fromEntries(new FormData(form).entries());

      if (data.id) {
        var index = getLog().findIndex(function(item) { return item.id === data.id; });
        if (index >= 0) {
          getLog()[index] = Object.assign({}, getLog()[index], data, { updated_at: N.utils.nowISO() });
          N.audit.log('dte_update', { id: data.id, folio: data.folio });
        }
      } else {
        var newItem = Object.assign({}, data, {
          id: N.utils.uid('dte'),
          status: data.status || 'pending',
          created_at: N.utils.nowISO()
        });
        getLog().push(newItem);
        N.audit.log('dte_create', { id: newItem.id, folio: newItem.folio });
      }

      await N.data.saveState();
      N.ui.closeModal();
      render();
    } finally {
      unlock();
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Eliminar este DTE?')) return;
    N.state.meta.dteLog = getLog().filter(function(item) { return item.id !== id; });
    N.audit.log('dte_delete', { id: id });
    await N.data.saveState();
    render();
  }

  function render() {
    if (!ui.container) return;

    N.ui.setViewTitle('DTE');
    N.ui.setActiveNav(VIEW_ID);

    var companies = getVisibleCompanies();

    var columns = [
      { key: 'folio', label: 'Folio' },
      { key: 'company_id', label: 'Empresa', formatter: function(value) {
        var company = companies.find(function(item) { return item.id === value; });
        if (!company) return N.utils.escapeHtml(value || '-');
        var label = company.name || value || '-';
        var index = companies.indexOf(company);
        var code = company.company_code || ('C-' + String(index + 1).padStart(3, '0'));
        if (code) {
          label += ' (' + code + ')';
        }
        return N.utils.escapeHtml(label);
      } },
      { key: 'status', label: 'Estado', formatter: function(value) {
        return '<span class="status status-' + value + '">' + N.utils.escapeHtml(N.utils.getStatusLabel(value)) + '</span>';
      } },
      { key: 'total', label: 'Total' },
      { key: 'notes', label: 'Notas' }
    ];

    if (canManage()) {
      columns.push({
        key: 'actions',
        label: 'Acciones',
        formatter: function(_, row) {
          return (
            '<button class="btn btn-sm btn-secondary" data-action="edit" data-id="' + row.id + '">Editar</button>' +
            '<button class="btn btn-sm btn-danger" data-action="delete" data-id="' + row.id + '">Borrar</button>'
          );
        }
      });
    }

    N.ui.renderTable('#dte-list', columns, getVisibleLog(), {
      emptyState: {
        title: 'Sin DTE',
        message: 'Agrega un DTE para comenzar.'
      }
    });
  }

  dte.init = function() {
    ui = {
      container: N.utils.$('#dte-content'),
      list: N.utils.$('#dte-list'),
      createBtn: N.utils.$('#dte-create-btn'),
      refreshBtn: N.utils.$('#dte-refresh-btn')
    };

    if (!ui.container) return;

    if (ui.createBtn) {
      ui.createBtn.style.display = canManage() ? '' : 'none';
      if (canManage()) {
        ui.createBtn.addEventListener('click', function() { openDteModal(null); });
      }
    }

    if (ui.refreshBtn) {
      ui.refreshBtn.addEventListener('click', function() {
        N.data.loadRemoteState();
      });
    }

    if (ui.list) {
      ui.list.addEventListener('click', function(event) {
        var button = event.target.closest('button[data-action]');
        if (!button) return;
        if (!canManage()) return;

        var action = button.getAttribute('data-action');
        var id = button.getAttribute('data-id');
        var item = getLog().find(function(row) { return row.id === id; });

        if (action === 'edit' && item) openDteModal(item);
        if (action === 'delete') handleDelete(id);
      });
    }

    document.addEventListener('state:updated', function() {
      render();
    });
  };

  dte.render = render;
})(window.Aexfy);

