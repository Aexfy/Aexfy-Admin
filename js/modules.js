// js/modules.js

(function(N) {
  'use strict';

  if (!N) return;

  var modules = N.modules = {};
  var VIEW_ID = 'modulos';
  var ui = {};
  var selectedCompanyId = null;

  var AVAILABLE_MODULES = [
    { key: 'inventory', label: 'Inventario' },
    { key: 'billing', label: 'Facturacion y DTE' },
    { key: 'ecommerce', label: 'E-commerce' },
    { key: 'reports', label: 'Reportes' },
    { key: 'pos', label: 'POS' }
  ];

  function canManage() {
    var level = N.state.session && N.state.session.accessLevel;
    return level === 'owner' || level === 'manager';
  }

  function getSelectedCompany() {
    if (!selectedCompanyId && N.state.companies.length) {
      selectedCompanyId = N.state.companies[0].id;
    }
    return N.state.companies.find(function(item) { return item.id === selectedCompanyId; });
  }

  function renderModulesList(company) {
    if (!ui.moduleList) return;

    if (!company) {
      ui.moduleList.innerHTML = '';
      N.ui.renderEmptyState('#modules-list', {
        title: 'Sin empresa',
        message: 'Selecciona una empresa para ver sus modulos.'
      });
      return;
    }

    var enabled = Array.isArray(company.modules) ? company.modules : [];
    var disabledAttr = canManage() ? '' : ' disabled';

    ui.moduleList.innerHTML = AVAILABLE_MODULES.map(function(item) {
      var checked = enabled.indexOf(item.key) >= 0 ? ' checked' : '';
      return '<label class="module-toggle">' +
        '<input type="checkbox" value="' + item.key + '"' + checked + disabledAttr + '>' +
        '<span>' + item.label + '</span>' +
      '</label>';
    }).join('');
  }

  function render() {
    if (!ui.container) return;

    N.ui.setViewTitle('Modulos');
    N.ui.setActiveNav(VIEW_ID);

    if (!N.state.companies.length) {
      N.ui.renderEmptyState('#modules-list', {
        title: 'Sin empresas',
        message: 'Crea empresas para gestionar modulos.'
      });
      if (ui.companySelect) ui.companySelect.innerHTML = '';
      return;
    }

    if (ui.companySelect) {
      ui.companySelect.innerHTML = N.state.companies.map(function(company) {
        return '<option value="' + company.id + '">' + N.utils.escapeHtml(company.name || company.id) + '</option>';
      }).join('');
      if (selectedCompanyId) {
        ui.companySelect.value = selectedCompanyId;
      } else if (N.state.companies.length) {
        ui.companySelect.value = N.state.companies[0].id;
        selectedCompanyId = ui.companySelect.value;
      }
    }

    renderModulesList(getSelectedCompany());
  }

  async function handleSave() {
    if (!canManage()) return;
    var company = getSelectedCompany();
    if (!company) return;
    var unlock = N.utils.lockButton(ui.saveBtn);
    if (!unlock) return;

    var enabled = [];
    ui.moduleList.querySelectorAll('input[type="checkbox"]:checked').forEach(function(input) {
      enabled.push(input.value);
    });

    company.modules = enabled;
    company.updated_at = N.utils.nowISO();
    N.audit.log('modules_update', { id: company.id, modules: enabled });
    try {
      await N.data.saveState();
      N.ui.showToast('Modulos actualizados', 'success');
    } finally {
      unlock();
    }
  }

  modules.init = function() {
    ui = {
      container: N.utils.$('#modulos-content'),
      companySelect: N.utils.$('#modules-company-select'),
      moduleList: N.utils.$('#modules-list'),
      saveBtn: N.utils.$('#modules-save-btn')
    };

    if (!ui.container) return;

    if (ui.companySelect) {
      ui.companySelect.addEventListener('change', function(e) {
        selectedCompanyId = e.target.value;
        renderModulesList(getSelectedCompany());
      });
    }

    if (ui.saveBtn) {
      ui.saveBtn.style.display = canManage() ? '' : 'none';
      if (canManage()) {
        ui.saveBtn.addEventListener('click', handleSave);
      }
    }

    document.addEventListener('state:updated', function() {
      render();
    });
  };

  modules.render = render;
})(window.Aexfy);

