// js/companies.js

(function(N) {
  'use strict';

  if (!N) return;

  var companies = N.companies = {};
  var VIEW_ID = 'empresas';
  var ui = {};

  var AVAILABLE_MODULES = [
    { key: 'inventory', label: 'Inventario' },
    { key: 'billing', label: 'Facturacion y DTE' },
    { key: 'ecommerce', label: 'E-commerce' },
    { key: 'reports', label: 'Reportes' },
    { key: 'pos', label: 'POS' }
  ];

  var ZONE_RULES = [
    { prefix: 'NG', regions: ['arica y parinacota', 'tarapaca', 'antofagasta'] },
    { prefix: 'NC', regions: ['atacama', 'coquimbo'] },
    { prefix: 'CT', regions: ['valparaiso', 'metropolitana', 'ohiggins', 'maule'] },
    { prefix: 'SR', regions: ['nuble', 'biobio', 'la araucania', 'los rios'] },
    { prefix: 'AU', regions: ['los lagos', 'aysen', 'magallanes'] }
  ];

  function normalizeRegion(value) {
    var text = String(value || '').trim().toLowerCase();
    if (!text) return '';
    text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    text = text.replace(/[^a-z0-9\s]/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  function getZonePrefix(region) {
    var normalized = normalizeRegion(region);
    if (!normalized) return '';
    var compact = normalized.replace(/\s/g, '');
    for (var i = 0; i < ZONE_RULES.length; i += 1) {
      var rule = ZONE_RULES[i];
      var match = rule.regions.some(function(name) {
        var compactName = name.replace(/\s/g, '');
        return normalized === name ||
          normalized.indexOf(name) >= 0 ||
          compact === compactName ||
          compact.indexOf(compactName) >= 0;
      });
      if (match) return rule.prefix;
    }
    return '';
  }

  function formatCompanyCode(prefix, seq) {
    return prefix + '-' + String(seq).padStart(4, '0');
  }

  function getNextCompanyCode(region, excludeId) {
    var prefix = getZonePrefix(region);
    var max = 0;
    (N.state.companies || []).forEach(function(company) {
      if (excludeId && company.id === excludeId) return;
      var code = String(company.company_code || '').toUpperCase();
      if (code.indexOf(prefix + '-') !== 0) return;
      var match = code.match(/-(\d+)/);
      if (!match) return;
      var value = parseInt(match[1], 10);
      if (!isNaN(value) && value > max) {
        max = value;
      }
    });
    return formatCompanyCode(prefix, max + 1);
  }

  function getCompanyCode(company, index) {
    if (!company) return '';
    var prefix = getZonePrefix(company.region || '');
    var code = company.company_code ? String(company.company_code).toUpperCase() : '';
    if (code && (!prefix || code.indexOf(prefix + '-') === 0)) return code;
    if (!prefix) return code || '';
    var list = (N.state.companies || []).filter(function(item) {
      return getZonePrefix(item.region || '') === prefix;
    });
    var position = index;
    if (position === undefined || position === null) {
      position = list.findIndex(function(item) { return item.id === company.id; });
    }
    return formatCompanyCode(prefix, (position >= 0 ? position : 0) + 1);
  }

  function ensureCompanyCode(company, region, excludeId) {
    var prefix = getZonePrefix(region);
    if (!prefix) return company.company_code || '';
    var code = String(company.company_code || '').toUpperCase();
    if (code && code.indexOf(prefix + '-') === 0) return code;
    return getNextCompanyCode(region, excludeId);
  }

  function canManage() {
    var level = N.state.session && N.state.session.accessLevel;
    return level === 'owner' || level === 'manager' || level === 'supervisor';
  }

  function canApproveRequests() {
    var level = N.state.session && N.state.session.accessLevel;
    return level === 'owner' || level === 'manager' || level === 'supervisor';
  }

  function getRequests() {
    if (!N.state.meta.companyRequests) {
      N.state.meta.companyRequests = [];
    }
    return N.state.meta.companyRequests;
  }

  function setFormError(form, message) {
    if (!form) return;
    var errorEl = form.querySelector('[data-form-error]');
    if (errorEl) {
      errorEl.textContent = message || '';
    }
  }

  function normalizeRut(value) {
    return N.utils.formatRUT(value || '').toUpperCase();
  }

  function isValidEmail(email) {
    var value = String(email || '').trim();
    if (!value) return false;
    if (value.indexOf(',') >= 0 || value.indexOf(';') >= 0) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function normalizePhone(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    var hasPlus = raw[0] === '+';
    var digits = raw.replace(/\D/g, '');
    return (hasPlus ? '+' : '') + digits;
  }

  function normalizeCompanyPayload(raw) {
    var payload = Object.assign({}, raw || {});
    payload.activity_code = String(payload.activity_code || payload.actividad_economica || '').trim();
    payload.phone = normalizePhone(payload.phone || payload.telefono || '');
    payload.city = String(payload.city || payload.ciudad || '').trim();
    payload.address = String(payload.address || payload.direccion || '').trim();
    delete payload.actividad_economica;
    delete payload.telefono;
    delete payload.ciudad;
    delete payload.direccion;
    return payload;
  }

  function bindRutInput(form) {
    var rutInput = form.querySelector('[name="rut"]');
    if (!rutInput) return;
    rutInput.addEventListener('input', function() {
      var formatted = N.utils.formatRUT(rutInput.value);
      rutInput.value = formatted.toUpperCase();
    });
  }

  function bindPhoneInput(form) {
    var phoneInput = form.querySelector('[name="telefono"]');
    if (!phoneInput) return;
    phoneInput.addEventListener('input', function() {
      var filtered = phoneInput.value.replace(/[^\d+\s]/g, '');
      if (phoneInput.value !== filtered) {
        phoneInput.value = filtered;
      }
    });
  }

  function renderModuleOptions(container, company) {
    if (!container) return;
    var selected = company && Array.isArray(company.modules) ? company.modules : [];
    container.innerHTML = AVAILABLE_MODULES.map(function(item) {
      var isChecked = selected.indexOf(item.key) >= 0;
      return '<label class="check-pill">' +
        '<input type="checkbox" name="modules" value="' + item.key + '"' + (isChecked ? ' checked' : '') + '>' +
        '<span>' + item.label + '</span>' +
      '</label>';
    }).join('');
  }

  function applyPrefill(form, prefill) {
    if (!form || !prefill) return;
    Object.keys(prefill).forEach(function(key) {
      var input = form.querySelector('[name="' + key + '"]');
      if (input) input.value = prefill[key] || '';
    });
  }

  function getPasswordRedirectUrl() {
    try {
      return new URL('crear-contrasena.html', window.location.href).href;
    } catch (_err) {
      return '';
    }
  }

  function openCompanyModal(company) {
    var isEditing = !!company;
    var template = N.utils.$('#company-form-template');
    if (!template) return;

    var fragment = template.content.cloneNode(true);
    var form = fragment.querySelector('#company-form');
    if (!form) return;

    var prefill = null;

    var requesterEmail = N.state.session && N.state.session.user ? N.state.session.user.email : '';

    if (isEditing) {
      prefill = {
        id: company.id || '',
        name: company.name || '',
        rut: company.rut ? normalizeRut(company.rut) : '',
        giro: company.giro || '',
        actividad_economica: company.activity_code || company.actividad_economica || '',
        email_tributario: company.email_tributario || '',
        telefono: company.phone ? N.utils.formatPhone(company.phone) : (company.telefono ? N.utils.formatPhone(company.telefono) : ''),
        region: company.region || '',
        ciudad: company.city || company.ciudad || '',
        comuna: company.comuna || '',
        direccion: company.address || company.direccion || '',
        plan: company.plan || 'starter',
        status: company.status || 'active',
        owner_email: company.owner_email || '',
        seller_email: company.seller_email || requesterEmail || ''
      };
    } else {
      prefill = {
        seller_email: requesterEmail || ''
      };
    }

    var footer =
      '<div class="btn-group">' +
        '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
        '<button type="submit" form="company-form" class="btn btn-primary">Guardar</button>' +
      '</div>';

    var overlay = N.ui.showModal(isEditing ? 'Editar empresa' : 'Nueva empresa', form.outerHTML, footer);
    if (!overlay) return;

    var modalForm = N.utils.$('#company-form');
    if (modalForm) {
      modalForm.addEventListener('submit', handleFormSubmit);
      bindRutInput(modalForm);
      bindPhoneInput(modalForm);
      renderModuleOptions(modalForm.querySelector('[data-modules]'), company);
      applyPrefill(modalForm, prefill);
      var sellerInput = modalForm.querySelector('[name="seller_email"]');
      if (sellerInput) {
        sellerInput.setAttribute('readonly', 'readonly');
      }
    }

    var closeBtn = N.utils.$('[data-modal-close]', overlay);
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        N.ui.closeModal();
      });
    }
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    var form = event.target;
    setFormError(form, '');
    if (form.checkValidity && !form.checkValidity()) {
      form.reportValidity();
      return;
    }
    var unlock = N.utils.lockForm(form);
    if (!unlock) return;
    try {
      var formData = new FormData(form);
      var data = {};
      formData.forEach(function(value, key) {
        if (key !== 'modules') data[key] = value;
      });

      data.name = String(data.name || '').trim();
      data.giro = String(data.giro || '').trim();
      data.activity_code = String(data.activity_code || data.actividad_economica || '').trim();
      data.email_tributario = N.utils.normalizeEmail(data.email_tributario);
      data.phone = normalizePhone(data.phone || data.telefono);
      data.region = String(data.region || '').trim();
      data.city = String(data.city || data.ciudad || '').trim();
      data.comuna = String(data.comuna || '').trim();
      data.address = String(data.address || data.direccion || '').trim();
      data.rut = normalizeRut(data.rut);
      data = normalizeCompanyPayload(data);

      var zonePrefix = getZonePrefix(data.region);
      if (!zonePrefix) {
        setFormError(form, 'Region no valida. Usa una region de Chile.');
        unlock();
        return;
      }

      var requesterEmail = N.state.session && N.state.session.user ? N.utils.normalizeEmail(N.state.session.user.email) : '';
      if (!data.id) {
        data.seller_email = requesterEmail;
      }

      if (!isValidEmail(data.email_tributario)) {
        setFormError(form, 'Ingresa un email tributario valido.');
        unlock();
        return;
      }

      var modules = [];
      form.querySelectorAll('input[name="modules"]:checked').forEach(function(input) {
        modules.push(input.value);
      });

      var isEditing = !!data.id;
      if (!isEditing) {
        if (!isValidEmail(data.owner_email)) {
          setFormError(form, 'Ingresa el email del cliente (Owner) para enviar la invitacion.');
          unlock();
          return;
        }
      }
      if (isEditing) {
        var index = N.state.companies.findIndex(function(item) { return item.id === data.id; });
        if (index >= 0) {
          var currentCompany = N.state.companies[index];
          var companyCode = ensureCompanyCode(currentCompany, data.region, data.id);
          var updatedCompany = Object.assign({}, N.state.companies[index], data, {
            modules: modules,
            company_code: companyCode,
            updated_at: N.utils.nowISO()
          });
          delete updatedCompany.actividad_economica;
          delete updatedCompany.telefono;
          delete updatedCompany.ciudad;
          delete updatedCompany.direccion;
          N.state.companies[index] = updatedCompany;
          N.audit.log('company_update', { id: data.id, name: data.name });
        }
      } else {
        var sessionUser = N.state.session ? N.state.session.user : null;
        var request = {
          id: N.utils.uid('co_req'),
          created_at: N.utils.nowISO(),
          status: 'pending',
          requester_email: sessionUser ? sessionUser.email : 'unknown',
          requester_roles: sessionUser ? N.utils.getUserRoles(sessionUser) : [],
          payload: Object.assign({}, data, {
            plan: data.plan || 'starter',
            status: data.status || 'pending',
            modules: modules
          })
        };
        getRequests().push(request);
        N.audit.log('company_request_create', { id: request.id, name: data.name });
        await N.data.saveState();
        N.ui.showToast('Solicitud enviada para aprobacion.', 'info');
        N.ui.closeModal();
        renderRequests();
        return;
      }

      await N.data.saveState();
      N.ui.closeModal();
      render();
    } finally {
      unlock();
    }
  }

  async function handleDelete(companyId) {
    var company = N.state.companies.find(function(item) { return item.id === companyId; });
    if (!company) return;

    if (!window.confirm('Eliminar esta empresa?')) return;

    N.state.companies = N.state.companies.filter(function(item) { return item.id !== companyId; });
    N.audit.log('company_delete', { id: companyId, name: company.name });
    await N.data.saveState();
    render();
  }

  function render(dataToRender) {
    if (!ui.container) return;

    var list = Array.isArray(dataToRender) ? dataToRender : N.state.companies;
    var editable = canManage();

    N.ui.setViewTitle('Empresas');
    N.ui.setActiveNav(VIEW_ID);

    var columns = [
      { key: 'company_code', label: 'ID', formatter: function(value, row) {
        var index = list.indexOf(row);
        return N.utils.escapeHtml(value || getCompanyCode(row, index));
      } },
      { key: 'name', label: 'Empresa' },
      { key: 'rut', label: 'RUT', formatter: function(value) { return N.utils.escapeHtml(N.utils.formatRUT(value)); } },
      { key: 'plan', label: 'Plan' },
      { key: 'status', label: 'Estado', formatter: function(value) {
        var label = N.utils.getStatusLabel(value);
        return '<span class="status status-' + value + '">' + N.utils.escapeHtml(label) + '</span>';
      } },
      { key: 'owner_email', label: 'Owner' },
      { key: 'seller_email', label: 'Vendedor' },
      { key: 'modules', label: 'Modulos', formatter: function(value) {
        if (!Array.isArray(value) || !value.length) return '-';
        return N.utils.escapeHtml(value.join(', '));
      } }
    ];

    if (editable) {
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

    N.ui.renderTable('#company-list', columns, list, {
      emptyState: {
        title: 'Sin empresas',
        message: 'Crea la primera empresa para comenzar.'
      }
    });
  }

  function renderRequests() {
    if (!ui.requestsList) return;
    var list = getRequests();

    var columns = [
      { key: 'created_at', label: 'Fecha' },
      { key: 'payload.name', label: 'Empresa' },
      { key: 'payload.rut', label: 'RUT', formatter: function(value) { return N.utils.escapeHtml(N.utils.formatRUT(value)); } },
      { key: 'requester_email', label: 'Solicitado por' },
      { key: 'status', label: 'Estado', formatter: function(value) {
        return '<span class="status status-' + value + '">' + N.utils.escapeHtml(N.utils.getStatusLabel(value)) + '</span>';
      } }
    ];

    if (canApproveRequests()) {
      columns.push({
        key: 'actions',
        label: 'Acciones',
        formatter: function(_, row) {
          if (row.status !== 'pending') return '-';
          return (
            '<button class="btn btn-sm btn-secondary" data-request-action="approve" data-id="' + row.id + '">Aprobar</button>' +
            '<button class="btn btn-sm btn-danger" data-request-action="reject" data-id="' + row.id + '">Rechazar</button>'
          );
        }
      });
    }

    N.ui.renderTable('#company-requests-list', columns, list, {
      emptyState: {
        title: 'Sin peticiones',
        message: 'No hay solicitudes pendientes.'
      }
    });

    if (ui.requestsSection) {
      ui.requestsSection.style.display = (list.length || canApproveRequests()) ? '' : 'none';
    }
  }

  async function handleApproveRequest(requestId, button) {
      var request = getRequests().find(function(item) { return item.id === requestId; });
    if (!request || request.status !== 'pending') return;
    var unlock = N.utils.lockButton(button);
    if (!unlock) return;

    try {
      var payload = normalizeCompanyPayload(request.payload || {});
      var newCompany = Object.assign({}, payload, {
        id: N.utils.uid('co'),
        company_code: getNextCompanyCode(payload.region || ''),
        plan: payload.plan || 'starter',
        status: payload.status || 'pending',
        modules: Array.isArray(payload.modules) ? payload.modules : [],
        created_at: N.utils.nowISO(),
        updated_at: N.utils.nowISO()
      });
      N.state.companies.push(newCompany);
      await inviteCompanyOwner(payload, newCompany);
      request.status = 'approved';
      request.approved_at = N.utils.nowISO();
      request.approved_by = N.state.session && N.state.session.user ? N.state.session.user.email : 'system';
      N.audit.log('company_request_approve', { id: request.id, name: payload.name });
      await N.data.saveState();
      render();
      renderRequests();
      N.ui.showToast('Solicitud aprobada.', 'success');
    } finally {
      unlock();
    }
  }

  async function handleRejectRequest(requestId, button) {
    var request = getRequests().find(function(item) { return item.id === requestId; });
    if (!request || request.status !== 'pending') return;
    var unlock = N.utils.lockButton(button);
    if (!unlock) return;
    try {
      request.status = 'rejected';
      request.rejected_at = N.utils.nowISO();
      request.rejected_by = N.state.session && N.state.session.user ? N.state.session.user.email : 'system';
      N.audit.log('company_request_reject', { id: request.id });
      await N.data.saveState();
      renderRequests();
    } finally {
      unlock();
    }
  }

  async function inviteCompanyOwner(payload, company) {
    if (!window.supabaseClient) return;
    var email = N.utils.normalizeEmail(payload.owner_email || '');
    if (!email || !isValidEmail(email)) return;

    var metadata = {
      first_name: payload.name || '',
      middle_name: '',
      last_name: '',
      mother_last_name: '',
      full_name: payload.name || '',
      company_id: company.id,
      company_name: company.name,
      company_code: company.company_code,
      company_rut: payload.rut || '',
      user_type: 'cliente',
      roles: ['cliente'],
      role: 'cliente'
    };

    try {
      var response = await window.supabaseClient.functions.invoke('admin-create-user', {
        body: {
          email: email,
          roles: ['cliente'],
          metadata: metadata,
          user_type: 'cliente',
          redirectTo: getPasswordRedirectUrl()
        }
      });

      if (response.error) throw response.error;

      if (response.data && response.data.error) throw new Error(response.data.error);

      var existing = response.data && response.data.existing;
      var already = N.state.users.find(function(item) {
        return N.utils.normalizeEmail(item.email) === email;
      });

      if (already) {
        already.user_metadata = Object.assign({}, already.user_metadata || {}, metadata);
      } else if (!existing) {
        var user = response.data && response.data.user ? response.data.user : null;
        N.state.users.push({
          id: user && user.id ? user.id : N.utils.uid('usr'),
          auth_id: user && user.id ? user.id : '',
          email: email,
          status: 'active',
          user_metadata: metadata,
          created_at: N.utils.nowISO()
        });
      }
    } catch (_err) {
      N.ui.showToast('No fue posible enviar la invitacion del cliente.', 'error');
    }
  }

  function handleSearch(event) {
    var term = event.target.value.trim().toLowerCase();
    if (!term) {
      render();
      return;
    }

    var filtered = N.state.companies.filter(function(company) {
      return (company.name || '').toLowerCase().indexOf(term) >= 0 ||
        (company.rut || '').toLowerCase().indexOf(term) >= 0 ||
        (company.owner_email || '').toLowerCase().indexOf(term) >= 0 ||
        (company.email_tributario || '').toLowerCase().indexOf(term) >= 0 ||
        (company.giro || '').toLowerCase().indexOf(term) >= 0 ||
        (company.company_code || '').toLowerCase().indexOf(term) >= 0;
    });

    render(filtered);
  }

  function updateActionButtons() {
    if (!ui.createBtn) return;
    var allowed = canManage();
    ui.createBtn.style.display = allowed ? '' : 'none';
    if (allowed && !ui.createBtn.dataset.bound) {
      ui.createBtn.addEventListener('click', function() {
        openCompanyModal(null);
      });
      ui.createBtn.dataset.bound = '1';
    }
  }

  companies.init = function() {
    ui = {
      container: N.utils.$('#empresas-content'),
      createBtn: N.utils.$('#create-company-btn'),
      search: N.utils.$('#company-search'),
      list: N.utils.$('#company-list'),
      requestsSection: N.utils.$('#company-requests-section'),
      requestsList: N.utils.$('#company-requests-list')
    };

    if (!ui.container) return;

    updateActionButtons();

    if (ui.search) {
      ui.search.addEventListener('input', N.utils.debounce(handleSearch, 300));
    }

    if (ui.list) {
      ui.list.addEventListener('click', function(event) {
        var button = event.target.closest('button[data-action]');
        if (!button) return;
        if (!canManage()) return;

        var action = button.getAttribute('data-action');
        var id = button.getAttribute('data-id');
        var company = N.state.companies.find(function(item) { return item.id === id; });

        if (action === 'edit' && company) openCompanyModal(company);
        if (action === 'delete') handleDelete(id);
      });
    }

    if (ui.requestsList) {
      ui.requestsList.addEventListener('click', function(event) {
        var button = event.target.closest('button[data-request-action]');
        if (!button) return;
        if (!canApproveRequests()) return;

        var action = button.getAttribute('data-request-action');
        var id = button.getAttribute('data-id');
        if (action === 'approve') handleApproveRequest(id, button);
        if (action === 'reject') handleRejectRequest(id, button);
      });
    }

    document.addEventListener('state:updated', function() {
      updateActionButtons();
      render();
      renderRequests();
    });
  };

  companies.render = render;
})(window.Aexfy);

