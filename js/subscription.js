// js/subscription.js

(function(N) {
  'use strict';

  if (!N) return;

  var subscription = N.subscription = {};
  var VIEW_ID = 'suscripcion';
  var ui = {};
  var selectedCompanyId = null;

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

  function fillForm(company) {
    if (!company || !ui.form) return;
    var sub = company.subscription || {};

    ui.form.querySelector('[name="plan"]').value = sub.plan || company.plan || 'starter';
    ui.form.querySelector('[name="status"]').value = sub.status || company.status || 'active';
    ui.form.querySelector('[name="limit_users"]').value = sub.limits && sub.limits.users ? sub.limits.users : '';
    ui.form.querySelector('[name="limit_pos"]').value = sub.limits && sub.limits.pos ? sub.limits.pos : '';
    ui.form.querySelector('[name="renew_date"]').value = sub.renew_date || '';
  }

  function render() {
    if (!ui.container) return;

    N.ui.setViewTitle('Suscripcion');
    N.ui.setActiveNav(VIEW_ID);

    if (!N.state.companies.length) {
      N.ui.renderEmptyState('#subscription-form-wrap', {
        title: 'Sin empresas',
        message: 'Crea una empresa para definir su suscripcion.'
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
      } else {
        ui.companySelect.value = N.state.companies[0].id;
        selectedCompanyId = ui.companySelect.value;
      }
    }

    fillForm(getSelectedCompany());
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!canManage()) return;
    var company = getSelectedCompany();
    if (!company) return;
    if (ui.form && ui.form.checkValidity && !ui.form.checkValidity()) {
      ui.form.reportValidity();
      return;
    }
    var unlock = N.utils.lockForm(ui.form);
    if (!unlock) return;

    var formData = new FormData(ui.form);
    var data = Object.fromEntries(formData.entries());

    company.subscription = {
      plan: data.plan || 'starter',
      status: data.status || 'active',
      renew_date: data.renew_date || '',
      limits: {
        users: data.limit_users || '',
        pos: data.limit_pos || ''
      }
    };

    company.plan = company.subscription.plan;
    company.status = company.subscription.status;
    company.updated_at = N.utils.nowISO();

    N.audit.log('subscription_update', { id: company.id, plan: company.plan, status: company.status });
    try {
      await N.data.saveState();
      N.ui.showToast('Suscripcion actualizada', 'success');
    } finally {
      unlock();
    }
  }

  subscription.init = function() {
    ui = {
      container: N.utils.$('#suscripcion-content'),
      companySelect: N.utils.$('#subscription-company-select'),
      form: N.utils.$('#subscription-form'),
      formWrap: N.utils.$('#subscription-form-wrap')
    };

    if (!ui.container) return;

    if (ui.companySelect) {
      ui.companySelect.addEventListener('change', function(e) {
        selectedCompanyId = e.target.value;
        fillForm(getSelectedCompany());
      });
    }

    if (ui.form) {
      ui.form.addEventListener('submit', handleSave);
      if (!canManage()) {
        ui.form.querySelectorAll('input, select, textarea, button').forEach(function(input) {
          input.setAttribute('disabled', 'disabled');
        });
      }
    }

    document.addEventListener('state:updated', function() {
      render();
    });
  };

  subscription.render = render;
})(window.Aexfy);

