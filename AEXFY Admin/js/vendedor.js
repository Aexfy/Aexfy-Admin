// js/vendedor.js

(function(N) {
  'use strict';

  if (!N) return;

  var vendedor = N.vendedor = {};
  var VIEW_ID = 'vendedor';
  var ui = {};

  function getAccessLevel() {
    return N.state.session && N.state.session.accessLevel ? N.state.session.accessLevel : 'none';
  }

  function canManage() {
    var level = getAccessLevel();
    return level === 'owner' || level === 'manager';
  }

  function getSellerEmail() {
    return N.state.session && N.state.session.user ? N.state.session.user.email : '';
  }

  function getVisibleCompanies() {
    return N.utils.filterCompaniesByAccess(N.state.companies || []);
  }

  function getCompaniesForView() {
    var level = getAccessLevel();
    if (level === 'seller') {
      var email = getSellerEmail();
      return getVisibleCompanies().filter(function(company) {
        return (company.seller_email || '').toLowerCase() === (email || '').toLowerCase();
      });
    }
    return getVisibleCompanies();
  }

  function render() {
    if (!ui.container) return;
    N.ui.setViewTitle('Vendedor');
    N.ui.setActiveNav(VIEW_ID);

    if (ui.assignSection) {
      ui.assignSection.style.display = canManage() ? '' : 'none';
    }

    if (ui.companySelect && canManage()) {
      ui.companySelect.innerHTML = getVisibleCompanies().map(function(company) {
        return '<option value="' + company.id + '">' + N.utils.escapeHtml(company.name || company.id) + '</option>';
      }).join('');
    }

    var list = getCompaniesForView();

    var columns = [
      { key: 'name', label: 'Empresa' },
      { key: 'status', label: 'Estado', formatter: function(value) {
        return '<span class="status status-' + value + '">' + N.utils.escapeHtml(N.utils.getStatusLabel(value)) + '</span>';
      } },
      { key: 'plan', label: 'Plan' },
      { key: 'seller_email', label: 'Vendedor' }
    ];

    N.ui.renderTable('#seller-clients-list', columns, list, {
      emptyState: {
        title: 'Sin clientes',
        message: 'No hay empresas asignadas.'
      }
    });
  }

  async function handleAssign(event) {
    event.preventDefault();
    if (!canManage()) return;

    var form = event.target;
    if (form && form.checkValidity && !form.checkValidity()) {
      form.reportValidity();
      return;
    }
    var companyId = ui.companySelect ? ui.companySelect.value : '';
    var email = ui.sellerEmail ? ui.sellerEmail.value.trim() : '';
    if (!companyId || !email) return;

    var company = N.state.companies.find(function(item) { return item.id === companyId; });
    if (!company) return;

    var unlock = N.utils.lockForm(form);
    if (!unlock) return;

    try {
      company.seller_email = email;
      company.updated_at = N.utils.nowISO();

      N.audit.log('seller_assign', { id: company.id, seller_email: email });
      await N.data.saveState();
      N.ui.showToast('Vendedor asignado', 'success');
      render();
    } finally {
      unlock();
    }
  }

  vendedor.init = function() {
    ui = {
      container: N.utils.$('#vendedor-content'),
      list: N.utils.$('#seller-clients-list'),
      assignSection: N.utils.$('#seller-assign-section'),
      assignForm: N.utils.$('#seller-assign-form'),
      companySelect: N.utils.$('#seller-company-select'),
      sellerEmail: N.utils.$('#seller-email')
    };

    if (!ui.container) return;

    if (ui.assignForm) {
      ui.assignForm.addEventListener('submit', handleAssign);
    }

    document.addEventListener('state:updated', function() {
      render();
    });
  };

  vendedor.render = render;
})(window.Aexfy);

