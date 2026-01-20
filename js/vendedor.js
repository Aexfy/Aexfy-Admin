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

  function findCompany(id) {
    return N.state.companies.find(function(item) { return item.id === id; });
  }

  function nowIso() {
    return N.utils.nowISO();
  }

  function buildDocumentContent(company) {
    var name = company.name || 'Empresa';
    var owner = company.owner_email || 'owner@aexfy.cl';
    var info = [
      'Contrato de servicios Aexfy',
      'Cliente: ' + name,
      'RUT: ' + (company.rut || '---'),
      'Giro: ' + (company.giro || '---'),
      'Plan: ' + (company.plan || 'starter'),
      'Owner: ' + owner,
      'Region: ' + (company.region || '---'),
      'Ciudad: ' + (company.city || company.ciudad || '---'),
      'Comuna: ' + (company.comuna || '---'),
      'Direccion: ' + (company.address || company.direccion || '---'),
      'Fecha: ' + nowIso()
    ];
    return info.join('\\n');
  }

  function generateDocumentPdf(company) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      console.warn('Falta jsPDF para generar PDF.');
      return;
    }
    var { jsPDF } = window.jspdf;
    var doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Contrato de servicios Aexfy', 20, 25);
    doc.setFontSize(12);
      var modules = (company.modules || []).map(function(mod) { return mod.label || mod; }).join(', ') || 'Sin asignar';
      var lines = [
        'Cliente: ' + (company.name || 'Empresa'),
        'RUT: ' + (company.rut || '---'),
        'Giro: ' + (company.giro || '---'),
        'Código SII: ' + (company.activity_code || company.codigo_sii || '---'),
        'Plan: ' + (company.plan || 'starter'),
        'Estado: ' + (company.status || 'pending'),
        'Owner: ' + (company.owner_email || 'owner@aexfy.cl'),
        'Vendedor: ' + (company.seller_email || '---'),
        'Region: ' + (company.region || '---'),
        'Ciudad: ' + (company.city || company.ciudad || '---'),
        'Comuna: ' + (company.comuna || '---'),
        'Direccion: ' + (company.address || company.direccion || '---'),
        'Email tributario: ' + (company.email_tributario || '---'),
        'Telefono: ' + (company.phone || company.telefono || '---'),
        'Módulos activos: ' + modules,
        'Comentarios: ' + (company.notes || company.comments || '---'),
        'Fecha: ' + nowIso()
      ];
    lines.forEach(function(line, index) {
      doc.text(line, 20, 40 + (index * 8));
    });
    doc.save('Contrato.pdf');
  }

  function handleDocAction(event) {
    var button = event.target.closest('[data-doc-action]');
    if (!button) return;
    var action = button.getAttribute('data-doc-action');
    var id = button.getAttribute('data-id');
    var company = findCompany(id);
    if (!company) return;

    if (action === 'generate') {
      generateDocumentPdf(company);
      company.doc_generated_at = nowIso();
      N.audit.log('doc_generated', { id: company.id, seller: getSellerEmail() });
      N.data.saveState();
      N.ui.showToast('Documentos generados', 'success');
    }

    if (action === 'deliver') {
      company.documents_delivered = true;
      company.documents_delivered_at = nowIso();
      company.documents_delivered_by = getSellerEmail();
      N.audit.log('doc_delivered', { id: company.id, seller: getSellerEmail() });
      N.data.saveState();
      N.ui.showToast('Documentos marcados como entregados', 'success');
      N.ui.notify('Supervisor', 'El vendedor ha entregado los documentos para ' + (company.name || 'la empresa'));
    }

    render();
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
      { key: 'seller_email', label: 'Vendedor' },
      { key: 'documents', label: 'Documentos', formatter: function(_, company) {
        if (!company) return '';
        var label = company.doc_generated_at ? 'Actualizar docs' : 'Generar documentos';
        return '<button class="btn btn-outline btn-sm" data-doc-action="generate" data-id="' + company.id + '">' + label + '</button>';
      }},
      { key: 'docs_status', label: 'Documentos firmados', formatter: function(_, company) {
        if (!company) return '';
        var delivered = !!company.documents_delivered;
        var text = delivered ? 'Firmados entregados' : 'Pendiente entrega';
        var btnLabel = delivered ? 'Reenviar' : 'Marcar como entregado';
        return '<div class="doc-status-row">' +
          '<span>' + N.utils.escapeHtml(text) + '</span>' +
          '<button class="btn btn-secondary btn-sm" data-doc-action="deliver" data-id="' + company.id + '">' + btnLabel + '</button>' +
        '</div>';
      }}
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

    if (ui.list) {
      ui.list.addEventListener('click', function(event) {
        handleDocAction(event);
      });
    }

    document.addEventListener('state:updated', function() {
      render();
    });
  };

  vendedor.render = render;
})(window.Aexfy);

