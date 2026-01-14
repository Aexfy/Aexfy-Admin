// js/users.js

(function(N) {
  'use strict';

  if (!N) return;

  var users = N.users = {};
  var VIEW_ID = 'usuarios';
  var ui = {};

  var ROLE_OPTIONS = [
    { value: 'gerente', label: 'Gerente' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'vendedor', label: 'Vendedor' },
    { value: 'instalador', label: 'Instalador' },
    { value: 'capacitador', label: 'Capacitador' },
    { value: 'jefe_soporte', label: 'Jefe de soporte' },
    { value: 'soporte', label: 'Soporte' },
    { value: 'jefe_rrhh', label: 'Jefe RRHH' },
    { value: 'rrhh', label: 'RRHH' }
  ];

  function getCurrentRoles() {
    var sessionUser = N.state.session ? N.state.session.user : null;
    return N.utils.getUserRoles(sessionUser);
  }

  function canManage() {
    var level = N.state.session && N.state.session.accessLevel;
    return level === 'owner' || level === 'manager' || level === 'hr' || level === 'supervisor';
  }

  function canApproveRequests() {
    var level = N.state.session && N.state.session.accessLevel;
    return level === 'owner' || level === 'manager';
  }

  function getAllowedRoleOptions() {
    var roles = getCurrentRoles();
    var allowed = N.roles ? N.roles.getAllowedAssignments(roles) : [];
    if (!allowed.length && N.state.session && N.state.session.accessLevel === 'owner') {
      allowed = ROLE_OPTIONS.map(function(option) { return option.value; });
    }
    return allowed.filter(function(role) {
      return ROLE_OPTIONS.some(function(option) { return option.value === role; });
    });
  }

  function getRequestableRoleOptions() {
    var roles = getCurrentRoles();
    return N.roles ? N.roles.getRequestableRoles(roles) : [];
  }

  function getRequests() {
    if (!N.state.meta.userRequests) {
      N.state.meta.userRequests = [];
    }
    return N.state.meta.userRequests;
  }

  function isClientRole(roles) {
    if (!Array.isArray(roles)) return false;
    return roles.indexOf('cliente') >= 0 || roles.indexOf('client') >= 0;
  }

  function normalizeUserType(value) {
    return value === 'cliente' ? 'cliente' : 'staff';
  }

  function getFormUserType(form) {
    if (!form) return 'staff';
    var select = form.querySelector('[name="user_type"]');
    return normalizeUserType(select ? select.value : '');
  }

  function getUserTypeFromUser(user) {
    if (!user) return 'staff';
    var meta = user.user_metadata || {};
    var type = meta.user_type || '';
    if (!type && isClientRole(N.utils.getUserRoles(user))) {
      type = 'cliente';
    }
    return normalizeUserType(type);
  }

  function getUserTypeFromRoles(roles, explicitType) {
    var normalized = normalizeUserType(explicitType || '');
    if (normalized === 'cliente') return 'cliente';
    return isClientRole(roles) ? 'cliente' : 'staff';
  }

  function sanitizeNameValue(value) {
    return String(value || '').replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim();
  }

  function buildFullName(data) {
    var parts = [
      sanitizeNameValue(data.first_name),
      sanitizeNameValue(data.middle_name),
      sanitizeNameValue(data.last_name),
      sanitizeNameValue(data.mother_last_name)
    ].filter(Boolean);
    return parts.join(' ');
  }

  function splitLegacyName(fullName) {
    var cleaned = sanitizeNameValue(fullName);
    var parts = cleaned ? cleaned.split(' ') : [];
    if (!parts.length) {
      return { first_name: '', middle_name: '', last_name: '', mother_last_name: '' };
    }
    if (parts.length === 1) {
      return { first_name: parts[0], middle_name: '', last_name: '', mother_last_name: '' };
    }
    if (parts.length === 2) {
      return { first_name: parts[0], middle_name: '', last_name: parts[1], mother_last_name: '' };
    }
    if (parts.length === 3) {
      return { first_name: parts[0], middle_name: parts[1], last_name: parts[2], mother_last_name: '' };
    }
    return {
      first_name: parts[0],
      middle_name: parts.slice(1, parts.length - 2).join(' '),
      last_name: parts[parts.length - 2],
      mother_last_name: parts[parts.length - 1]
    };
  }

  function setFormError(form, message) {
    if (!form) return;
    var errorEl = form.querySelector('[data-form-error]');
    if (errorEl) {
      errorEl.textContent = message || '';
    }
  }

  function getCompanyCode(company, index) {
    if (!company) return '';
    if (company.company_code) return company.company_code;
    if (company.code) return company.code;
    var position = index;
    if (position === undefined || position === null) {
      position = (N.state.companies || []).findIndex(function(item) { return item.id === company.id; });
    }
    var seq = String((position >= 0 ? position : 0) + 1).padStart(3, '0');
    return 'C-' + seq;
  }

  function getCompanyOptions() {
    return (N.state.companies || []).map(function(company, index) {
      var code = getCompanyCode(company, index);
      return {
        id: company.id,
        name: company.name || '',
        code: code,
        label: (company.name || 'Empresa sin nombre') + ' (' + code + ')'
      };
    });
  }

  function renderRoleOptions(container, selectedRoles, allowedRoles) {
    if (!container) return;
    var allowAll = !allowedRoles.length && (N.state.session && N.state.session.accessLevel === 'owner');
    var options = ROLE_OPTIONS.filter(function(option) {
      if (allowAll) return true;
      if (!allowedRoles.length) return false;
      return allowedRoles.indexOf(option.value) >= 0 || selectedRoles.indexOf(option.value) >= 0;
    });

    if (!options.length) {
      container.innerHTML = '<div class="text-muted">Sin permisos para asignar roles.</div>';
      return;
    }

    container.innerHTML = options.map(function(option) {
      var checked = selectedRoles.indexOf(option.value) >= 0 ? ' checked' : '';
      return (
        '<label class="role-chip" data-role="' + option.value + '">' +
          '<input type="checkbox" name="roles" value="' + option.value + '"' + checked + '>' +
          '<span>' + option.label + '</span>' +
        '</label>'
      );
    }).join('');
  }

  function toggleRequestFields(form, isRequest) {
    if (!form) return;
    form.querySelectorAll('[data-request-only]').forEach(function(item) {
      item.style.display = isRequest ? '' : 'none';
    });
    form.querySelectorAll('[data-request-hide]').forEach(function(item) {
      item.style.display = isRequest ? 'none' : '';
    });
  }

  function bindNameInputs(form) {
    if (!form) return;
    form.querySelectorAll('[data-name-field]').forEach(function(input) {
      input.addEventListener('input', function() {
        var cleaned = sanitizeNameValue(input.value);
        if (input.value !== cleaned) {
          input.value = cleaned;
        }
      });
    });
  }

  function bindRutInput(form) {
    var rutInput = form.querySelector('[name="rut"]');
    if (!rutInput) return;
    rutInput.addEventListener('input', function() {
      var formatted = N.utils.formatRUT(rutInput.value);
      rutInput.value = formatted.toUpperCase();
    });
  }

  function getSelectedRoles(form) {
    if (!form) return [];
    var roles = [];
    form.querySelectorAll('input[name="roles"]:checked').forEach(function(input) {
      roles.push(input.value);
    });
    return roles;
  }

  function updateTypeFields(form, allowedRoles) {
    if (!form) return;
    var userType = getFormUserType(form);
    var isClient = userType === 'cliente';
    var roleSection = form.querySelector('[data-role-section]');
    var rolesContainer = form.querySelector('[data-role-options]');

    if (roleSection) {
      roleSection.style.display = isClient ? 'none' : '';
    }

    if (rolesContainer) {
      if (isClient) {
        rolesContainer.innerHTML = '';
      } else {
        renderRoleOptions(rolesContainer, getSelectedRoles(form), allowedRoles);
      }
    }

    updateCompanyFields(form, isClient);
  }

  function bindTypeSelect(form, allowedRoles, isRequest) {
    if (!form) return;
    var typeSelect = form.querySelector('[name="user_type"]');
    if (!typeSelect) return;
    if (isRequest) {
      typeSelect.value = 'cliente';
      typeSelect.setAttribute('disabled', 'disabled');
    }
    typeSelect.addEventListener('change', function() {
      updateTypeFields(form, allowedRoles);
    });
    updateTypeFields(form, allowedRoles);
  }

  function setCompanySelection(form, company) {
    if (!form) return;
    var searchInput = form.querySelector('[name="company_search"]');
    var nameInput = form.querySelector('[name="company_name"]');
    var codeInput = form.querySelector('[name="company_code"]');
    var idInput = form.querySelector('[name="company_id"]');

    if (!company) {
      if (searchInput) searchInput.value = '';
      if (nameInput) nameInput.value = '';
      if (codeInput) codeInput.value = '';
      if (idInput) idInput.value = '';
      form.dataset.companyId = '';
      form.dataset.companyLabel = '';
      return;
    }

    var code = company.code || getCompanyCode(company);
    if (searchInput) searchInput.value = company.name ? company.name + ' (' + code + ')' : code;
    if (nameInput) nameInput.value = company.name || '';
    if (codeInput) codeInput.value = code || '';
    if (idInput) idInput.value = company.id || '';
    form.dataset.companyId = company.id || '';
    form.dataset.companyLabel = searchInput ? searchInput.value : '';
  }

  function renderCompanyResults(form, term) {
    var results = form.querySelector('[data-company-results]');
    if (!results) return;

    var query = String(term || '').toLowerCase().trim();
    var options = getCompanyOptions().filter(function(item) {
      if (!query) return true;
      return item.name.toLowerCase().indexOf(query) >= 0 || item.code.toLowerCase().indexOf(query) >= 0;
    });

    if (!options.length) {
      results.innerHTML = '<div class="search-empty">Sin resultados</div>';
      results.classList.add('is-visible');
      return;
    }

    results.innerHTML = options.map(function(item) {
      return '<div class="search-item" data-company-id="' + item.id + '">' +
        N.utils.escapeHtml(item.label) +
      '</div>';
    }).join('');
    results.classList.add('is-visible');
  }

  function bindCompanySearch(form) {
    if (!form) return;
    var searchInput = form.querySelector('[name="company_search"]');
    var results = form.querySelector('[data-company-results]');
    if (!searchInput || !results) return;

    searchInput.addEventListener('input', function() {
      if (form.dataset.companyId && searchInput.value !== form.dataset.companyLabel) {
        setCompanySelection(form, null);
      }
      renderCompanyResults(form, searchInput.value);
    });

    searchInput.addEventListener('focus', function() {
      renderCompanyResults(form, searchInput.value);
    });

    searchInput.addEventListener('blur', function() {
      setTimeout(function() {
        results.classList.remove('is-visible');
      }, 150);
    });

    results.addEventListener('click', function(event) {
      var item = event.target.closest('[data-company-id]');
      if (!item) return;
      var companyId = item.getAttribute('data-company-id');
      var company = (N.state.companies || []).find(function(entry) { return entry.id === companyId; });
      if (!company) return;
      setCompanySelection(form, company);
      results.classList.remove('is-visible');
    });
  }

  function updateCompanyFields(form, isClient) {
    if (!form) return;
    var section = form.querySelector('[data-company-section]');
    var searchInput = form.querySelector('[name="company_search"]');
    var results = form.querySelector('[data-company-results]');
    var enabled = !!isClient;

    if (section) {
      section.style.display = enabled ? '' : 'none';
    }
    if (searchInput) searchInput.disabled = !enabled;
    if (!enabled) {
      if (results) results.classList.remove('is-visible');
      setCompanySelection(form, null);
    }
  }

  function openUserModal(user, mode) {
    var isEditing = mode === 'edit';
    var isRequest = mode === 'request';
    var template = N.utils.$('#user-form-template');
    if (!template) return;

    var fragment = template.content.cloneNode(true);
    var form = fragment.querySelector('#user-form');
    if (!form) return;

    var selectedRoles = isEditing ? N.utils.getUserRoles(user) : [];
    var allowedRoles = isRequest ? getRequestableRoleOptions() : getAllowedRoleOptions();
    var initialType = isRequest ? 'cliente' : (isEditing ? getUserTypeFromUser(user) : 'staff');
    var initialIsClient = initialType === 'cliente';
    var initialCompanyId = '';
    var initialCompanyName = '';
    var initialCompanyCode = '';

    if (initialIsClient) {
      selectedRoles = ['cliente'];
    }

    if (!allowedRoles.length && !isEditing && !isRequest && initialType === 'staff' && N.state.session && N.state.session.accessLevel !== 'owner') {
      N.ui.showToast('No tienes permisos para asignar roles.', 'error');
      return;
    }

    if (isEditing && user) {
      var meta = user.user_metadata || {};
      var legacyName = splitLegacyName(meta.full_name || '');
      form.querySelector('[name="id"]').value = user.id || '';
      form.querySelector('[name="first_name"]').value = meta.first_name || legacyName.first_name || '';
      form.querySelector('[name="middle_name"]').value = meta.middle_name || legacyName.middle_name || '';
      form.querySelector('[name="last_name"]').value = meta.last_name || legacyName.last_name || '';
      form.querySelector('[name="mother_last_name"]').value = meta.mother_last_name || legacyName.mother_last_name || '';
      form.querySelector('[name="email"]').value = user.email || '';
      initialCompanyId = meta.company_id || '';
      initialCompanyName = meta.company_name || '';
      initialCompanyCode = meta.company_code || meta.company_id || '';
      form.querySelector('[name="rut"]').value = meta.rut ? N.utils.formatRUT(meta.rut) : '';
      form.querySelector('[name="status"]').value = user.status || 'active';
    }

    var typeSelect = form.querySelector('[name="user_type"]');
    if (typeSelect) {
      typeSelect.value = initialType;
      if (isRequest) typeSelect.setAttribute('disabled', 'disabled');
    }

    if (isEditing) {
      form.querySelector('[name="email"]').setAttribute('disabled', 'disabled');
    }

    var title = 'Nuevo usuario';
    if (isEditing) title = 'Editar usuario';
    if (isRequest) title = 'Solicitar usuario';

    var footer =
      '<div class="btn-group">' +
        '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
        '<button type="submit" form="user-form" class="btn btn-primary">' + (isRequest ? 'Enviar solicitud' : 'Guardar') + '</button>' +
      '</div>';

    var overlay = N.ui.showModal(title, form.outerHTML, footer);
    if (!overlay) return;

    var modalForm = N.utils.$('#user-form');
    if (modalForm) {
      modalForm.dataset.mode = mode;
      modalForm.addEventListener('submit', handleFormSubmit);
      bindNameInputs(modalForm);
      bindRutInput(modalForm);
      bindCompanySearch(modalForm);
      if (modalForm.querySelector('[name="user_type"]')) {
        modalForm.querySelector('[name="user_type"]').value = initialType;
      }
      var rolesContainer = modalForm.querySelector('[data-role-options]');
      renderRoleOptions(rolesContainer, selectedRoles, allowedRoles);
      toggleRequestFields(modalForm, isRequest);
      bindTypeSelect(modalForm, allowedRoles, isRequest);
      if (initialCompanyId && initialIsClient) {
        var companyMatch = (N.state.companies || []).find(function(item) { return item.id === initialCompanyId; });
        if (companyMatch) {
          setCompanySelection(modalForm, companyMatch);
        } else {
          modalForm.querySelector('[name="company_name"]').value = initialCompanyName;
          modalForm.querySelector('[name="company_code"]').value = initialCompanyCode;
          modalForm.querySelector('[name="company_id"]').value = initialCompanyId;
          modalForm.dataset.companyId = initialCompanyId;
        }
      } else {
        setCompanySelection(modalForm, null);
      }
    }

    var closeBtn = N.utils.$('[data-modal-close]', overlay);
    if (closeBtn) {
      closeBtn.addEventListener('click', function() { N.ui.closeModal(); });
    }
  }

  function collectRoles(form) {
    var userType = getFormUserType(form);
    if (userType === 'cliente') return ['cliente'];
    return getSelectedRoles(form);
  }

  function getUserPayload(data, roles, primaryRole, userType) {
    var resolvedType = getUserTypeFromRoles(roles, userType);
    var isClient = resolvedType === 'cliente';
    return {
      first_name: sanitizeNameValue(data.first_name),
      middle_name: sanitizeNameValue(data.middle_name),
      last_name: sanitizeNameValue(data.last_name),
      mother_last_name: sanitizeNameValue(data.mother_last_name),
      full_name: buildFullName(data),
      company_name: isClient ? (data.company_name || '') : '',
      company_id: isClient ? (data.company_id || '') : '',
      company_code: isClient ? (data.company_code || '') : '',
      rut: data.rut || '',
      user_type: resolvedType,
      roles: roles,
      role: primaryRole
    };
  }

  function isValidEmail(email) {
    var value = String(email || '').trim();
    if (!value) return false;
    if (value.indexOf(',') >= 0 || value.indexOf(';') >= 0) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function normalizeRut(value) {
    return N.utils.formatRUT(value || '').toUpperCase();
  }

  function validateRutRules(rutValue, isClient, editingId) {
    var rut = normalizeRut(rutValue);
    if (!rut) return '';

    var matches = N.state.users.filter(function(user) {
      if (editingId && user.id === editingId) return false;
      var meta = user.user_metadata || {};
      var existingRut = normalizeRut(meta.rut || user.rut || '');
      return existingRut && existingRut === rut;
    });

    if (!matches.length) return '';
    if (matches.length >= 2) return 'El RUT ya esta asociado a dos usuarios.';

    var existingMeta = matches[0].user_metadata || {};
    var existingIsClient = existingMeta.user_type === 'cliente' || isClientRole(N.utils.getUserRoles(matches[0]));
    if (!!isClient === existingIsClient) {
      return 'El RUT ya existe con el mismo tipo de rol.';
    }
    return '';
  }

  function getUserDisplayName(user) {
    if (!user) return '';
    var meta = user.user_metadata || {};
    if (meta.full_name) return meta.full_name;
    var fallback = buildFullName(meta);
    return fallback || user.email || '';
  }

  async function deleteRemoteUser(user) {
    if (!window.supabaseClient || !user || !user.id) return { ok: false, skipped: true };
    var response = await window.supabaseClient.functions.invoke('admin-user-action', {
      body: {
        action: 'delete',
        user_id: user.auth_id || user.id,
        user_email: user.email || ''
      }
    });
    if (response.error) throw response.error;
    if (response.data && response.data.error) {
      var err = new Error(response.data.message || response.data.error);
      err.code = response.data.error;
      throw err;
    }
    return response.data || { ok: true };
  }

  function getPasswordRedirectUrl() {
    try {
      return new URL('crear-contrasena.html', window.location.href).href;
    } catch (_err) {
      return '';
    }
  }

  async function createRemoteUser(data, roles, primaryRole, userType) {
    if (!window.supabaseClient) throw new Error('Supabase no disponible');

    var payload = {
      email: data.email,
      password: '',
      roles: roles,
      metadata: getUserPayload(data, roles, primaryRole, userType),
      user_type: getUserTypeFromRoles(roles, userType),
      redirectTo: getPasswordRedirectUrl()
    };

    var response = await window.supabaseClient.functions.invoke('admin-create-user', {
      body: payload
    });

    if (response.error) {
      var status = response.error.context && response.error.context.status ? response.error.context.status : null;
      var body = null;
      try {
        body = response.error.context ? await response.error.context.json() : null;
      } catch (_err) {
        body = null;
      }
      var err = new Error(body && body.error ? body.error : response.error.message);
      err.status = status;
      err.payload = body;
      throw err;
    }

    if (response.data && response.data.error) {
      var dataErr = new Error(response.data.error);
      dataErr.payload = response.data;
      throw dataErr;
    }

    return response.data || {};
  }

  async function addRequest(data, roles, primaryRole, reason, userType) {
    var sessionUser = N.state.session ? N.state.session.user : null;
    var request = {
      id: N.utils.uid('req'),
      created_at: N.utils.nowISO(),
      status: 'pending',
      requester_email: sessionUser ? sessionUser.email : 'unknown',
      requester_roles: sessionUser ? N.utils.getUserRoles(sessionUser) : [],
      reason: reason || 'Contratacion nueva',
      payload: Object.assign({}, getUserPayload(data, roles, primaryRole, userType), {
        email: data.email || '',
        status: data.status || 'active'
      })
    };

    getRequests().push(request);
    N.audit.log('user_request_create', { id: request.id, email: request.payload.email });
    await N.data.saveState();
    renderRequests();
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    var form = event.target;
    var mode = form.dataset.mode || 'create';
    var emailInput = form.querySelector('[name="email"]');
    if (emailInput) emailInput.removeAttribute('disabled');

    var data = Object.fromEntries(new FormData(form).entries());
    var userType = normalizeUserType(data.user_type);
    data.user_type = userType;
    var roles = collectRoles(form);
    var primaryRole = N.roles ? N.roles.getPrimaryRole(roles) : roles[0];
    var isEditing = mode === 'edit';
    var isRequest = mode === 'request';
    var isClient = userType === 'cliente';

    setFormError(form, '');

    if (form.checkValidity && !form.checkValidity()) {
      form.reportValidity();
      if (emailInput && isEditing) emailInput.setAttribute('disabled', 'disabled');
      return;
    }

    data.first_name = sanitizeNameValue(data.first_name);
    data.middle_name = sanitizeNameValue(data.middle_name);
    data.last_name = sanitizeNameValue(data.last_name);
    data.mother_last_name = sanitizeNameValue(data.mother_last_name);
    data.email = N.utils.normalizeEmail(data.email);
    data.rut = normalizeRut(data.rut);

    if (!data.first_name || !data.middle_name || !data.last_name || !data.mother_last_name) {
      setFormError(form, 'Completa todos los campos de nombre y apellidos.');
      if (emailInput && isEditing) emailInput.setAttribute('disabled', 'disabled');
      return;
    }

    if (!roles.length && userType === 'staff') {
      setFormError(form, 'Selecciona al menos un rol.');
      if (emailInput && isEditing) emailInput.setAttribute('disabled', 'disabled');
      return;
    }

    if (isClient && roles.length > 1) {
      setFormError(form, 'El rol Cliente no puede combinarse con otros roles.');
      if (emailInput && isEditing) emailInput.setAttribute('disabled', 'disabled');
      return;
    }

    if (!isValidEmail(data.email)) {
      setFormError(form, 'Ingresa un email valido.');
      if (emailInput && isEditing) emailInput.setAttribute('disabled', 'disabled');
      return;
    }

    if (isClient && !data.company_id) {
      setFormError(form, 'Selecciona una empresa para el cliente.');
      if (emailInput && isEditing) emailInput.setAttribute('disabled', 'disabled');
      return;
    }

    if (isClient && data.company_id && (!data.company_name || !data.company_code)) {
      var selectedCompany = (N.state.companies || []).find(function(item) { return item.id === data.company_id; });
      if (selectedCompany) {
        data.company_name = selectedCompany.name || data.company_name || '';
        data.company_code = selectedCompany.company_code || getCompanyCode(selectedCompany);
      }
    }

    if (!isClient) {
      data.company_id = '';
      data.company_name = '';
      data.company_code = '';
    }

    var rutError = validateRutRules(data.rut, isClient, isEditing ? data.id : '');
    if (rutError) {
      setFormError(form, rutError);
      if (emailInput && isEditing) emailInput.setAttribute('disabled', 'disabled');
      return;
    }

    if (emailInput && isEditing) emailInput.setAttribute('disabled', 'disabled');

    var unlock = N.utils.lockForm(form);
    if (!unlock) return;

    try {
      if (isEditing) {
        var index = N.state.users.findIndex(function(item) { return item.id === data.id; });
        if (index >= 0) {
          var current = N.state.users[index];
          current.user_metadata = current.user_metadata || {};
          current.user_metadata.first_name = data.first_name;
          current.user_metadata.middle_name = data.middle_name;
          current.user_metadata.last_name = data.last_name;
          current.user_metadata.mother_last_name = data.mother_last_name;
          current.user_metadata.full_name = buildFullName(data);
          current.user_metadata.company_name = data.company_name || '';
          current.user_metadata.company_id = data.company_id || '';
          current.user_metadata.company_code = data.company_code || '';
          current.user_metadata.rut = data.rut || '';
          current.user_metadata.user_type = userType;
          current.user_metadata.roles = roles;
          current.user_metadata.role = primaryRole;
          current.status = data.status || current.status || 'active';
          current.updated_at = N.utils.nowISO();
          N.audit.log('user_update', { id: current.id, email: current.email });
        }
        await N.data.saveState();
        N.ui.closeModal();
        render();
        return;
      }

      if (isRequest) {
        await addRequest(data, roles, primaryRole, data.request_reason, userType);
        N.ui.closeModal();
        return;
      }

      var result = await createRemoteUser(data, roles, primaryRole, userType);
      var existing = result && result.existing;
      var existingUser = N.state.users.find(function(item) {
        return N.utils.normalizeEmail(item.email) === N.utils.normalizeEmail(data.email);
      });
      var userPayload = getUserPayload(data, roles, primaryRole, userType);
      if (existing && existingUser) {
        existingUser.user_metadata = Object.assign({}, existingUser.user_metadata || {}, userPayload);
        existingUser.status = data.status || existingUser.status || 'active';
        existingUser.updated_at = N.utils.nowISO();
        N.audit.log('user_update', { id: existingUser.id, email: existingUser.email });
      } else {
        var user = result.user || {};
        var newUser = {
          id: user.id || N.utils.uid('usr'),
          auth_id: user.id || '',
          email: data.email || user.email || '',
          status: data.status || 'active',
          user_metadata: userPayload,
          created_at: N.utils.nowISO()
        };
        N.state.users.push(newUser);
        N.audit.log('user_create', { id: newUser.id, email: newUser.email });
      }
      await N.data.saveState();
      var invited = result && result.invited;
      N.ui.showToast(invited ? 'Invitacion enviada' : 'Usuario creado', 'success');
      N.ui.closeModal();
      render();
    } catch (err) {
      if (err && err.payload && err.payload.error === 'approval_required') {
        await addRequest(data, roles, primaryRole, data.request_reason, userType);
        N.ui.showToast('Solicitud creada. Requiere aprobacion.', 'info');
        N.ui.closeModal();
        return;
      }
      N.ui.showToast('No fue posible crear el usuario.', 'error');
    } finally {
      unlock();
    }
  }

  async function handleDelete(userId, button) {
    var user = N.state.users.find(function(item) { return item.id === userId; });
    if (!user) return;
    if (!window.confirm('Eliminar este usuario del estado?')) return;

    var unlock = N.utils.lockButton(button);
    if (!unlock) return;
    try {
      await deleteRemoteUser(user);
      N.state.users = N.state.users.filter(function(item) { return item.id !== userId; });
      N.audit.log('user_delete', { id: userId, email: user.email });
      await N.data.saveState();
      render();
    } catch (_err) {
      N.ui.showToast('No fue posible eliminar el usuario.', 'error');
    } finally {
      unlock();
    }
  }

  async function handleReset(userId) {
    if (!window.supabaseClient) return;
    var user = N.state.users.find(function(item) { return item.id === userId; });
    if (!user || !user.email) return;

    try {
      var redirectTo = new URL('crear-contrasena.html', window.location.href).href;
      var response = await window.supabaseClient.auth.resetPasswordForEmail(user.email, { redirectTo: redirectTo });
      if (response.error) throw response.error;
      N.ui.showToast('Email de recuperacion enviado', 'success');
    } catch (_err) {
      N.ui.showToast('No fue posible enviar el reset', 'error');
    }
  }

  function render(dataToRender) {
    if (!ui.container) return;

    var list = Array.isArray(dataToRender) ? dataToRender : N.state.users;
    var editable = canManage();

    N.ui.setViewTitle('Usuarios');
    N.ui.setActiveNav(VIEW_ID);

    var columns = [
      { key: 'user_metadata.full_name', label: 'Nombre', formatter: function(_, row) {
        return N.utils.escapeHtml(getUserDisplayName(row));
      } },
      { key: 'email', label: 'Email' },
      { key: 'roles', label: 'Roles', formatter: function(_, row) {
        var roles = N.utils.getUserRoles(row);
        return roles.length ? N.utils.getRoleLabel(roles) : '-';
      } },
      { key: 'user_metadata.company_name', label: 'Empresa', formatter: function(value, row) {
        var meta = row.user_metadata || {};
        var name = meta.company_name || '';
        var code = meta.company_code || '';
        if (!name && !code) return '-';
        if (code) {
          return N.utils.escapeHtml(name ? name + ' (' + code + ')' : code);
        }
        return N.utils.escapeHtml(name);
      } },
      { key: 'status', label: 'Estado', formatter: function(value) {
        return '<span class="status status-' + value + '">' + N.utils.escapeHtml(N.utils.getStatusLabel(value)) + '</span>';
      } }
    ];

    if (editable) {
      columns.push({
        key: 'actions',
        label: 'Acciones',
        formatter: function(_, row) {
          return (
            '<button class="btn btn-sm btn-secondary" data-action="edit" data-id="' + row.id + '">Editar</button>' +
            '<button class="btn btn-sm btn-outline" data-action="reset" data-id="' + row.id + '">Reset</button>' +
            '<button class="btn btn-sm btn-danger" data-action="delete" data-id="' + row.id + '">Borrar</button>'
          );
        }
      });
    }

    N.ui.renderTable('#user-list', columns, list, {
      emptyState: {
        title: 'Sin usuarios',
        message: 'No hay usuarios en el estado.'
      }
    });
  }

  function renderRequests() {
    if (!ui.requestsList) return;
    var list = getRequests();

    var columns = [
      { key: 'created_at', label: 'Fecha' },
      { key: 'payload.email', label: 'Email' },
      { key: 'payload.roles', label: 'Roles', formatter: function(_, row) {
        var roles = row.payload && row.payload.roles ? row.payload.roles : [];
        return roles.length ? N.utils.getRoleLabel(roles) : '-';
      } },
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

    N.ui.renderTable('#user-requests-list', columns, list, {
      emptyState: {
        title: 'Sin peticiones',
        message: 'No hay solicitudes pendientes.'
      }
    });

    if (ui.requestsSection) {
      ui.requestsSection.style.display = list.length || getRequestableRoleOptions().length || canApproveRequests() ? '' : 'none';
    }
  }

  async function handleApproveRequest(requestId, button) {
    var request = getRequests().find(function(item) { return item.id === requestId; });
    if (!request || request.status !== 'pending') return;
    var unlock = N.utils.lockButton(button);
    if (!unlock) return;

    try {
      var payload = request.payload || {};
      var roles = Array.isArray(payload.roles) ? payload.roles : ['cliente'];
      var primaryRole = N.roles ? N.roles.getPrimaryRole(roles) : roles[0];
      var userType = normalizeUserType(payload.user_type);
      var result = await createRemoteUser({
        email: payload.email,
        first_name: payload.first_name,
        middle_name: payload.middle_name,
        last_name: payload.last_name,
        mother_last_name: payload.mother_last_name,
        company_name: payload.company_name,
        company_id: payload.company_id,
        company_code: payload.company_code,
        rut: payload.rut,
        status: payload.status || 'active'
      }, roles, primaryRole, userType);

      var user = result.user || {};
      var newUser = {
        id: user.id || N.utils.uid('usr'),
        auth_id: user.id || '',
        email: payload.email || user.email || '',
        status: payload.status || 'active',
        user_metadata: payload,
        created_at: N.utils.nowISO()
      };
      N.state.users.push(newUser);
      request.status = 'approved';
      request.approved_at = N.utils.nowISO();
      request.approved_by = N.state.session && N.state.session.user ? N.state.session.user.email : 'system';
      await N.data.saveState();
      N.ui.showToast('Solicitud aprobada', 'success');
      render();
      renderRequests();
    } catch (_err) {
      N.ui.showToast('No fue posible aprobar la solicitud.', 'error');
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
      await N.data.saveState();
      renderRequests();
    } finally {
      unlock();
    }
  }

  function handleSearch(event) {
    var term = event.target.value.trim().toLowerCase();
    if (!term) {
      render();
      return;
    }

    var filtered = N.state.users.filter(function(user) {
      var name = getUserDisplayName(user).toLowerCase();
      var email = (user.email || '').toLowerCase();
      var company = user.user_metadata && user.user_metadata.company_name ? user.user_metadata.company_name.toLowerCase() : '';
      return name.indexOf(term) >= 0 || email.indexOf(term) >= 0 || company.indexOf(term) >= 0;
    });

    render(filtered);
  }

  function updateActionButtons() {
    var allowed = getAllowedRoleOptions();
    var requestable = getRequestableRoleOptions();

    if (ui.createBtn) {
      ui.createBtn.style.display = allowed.length ? '' : 'none';
      if (!ui.createBtn.dataset.bound) {
        ui.createBtn.addEventListener('click', function() {
          if (!getAllowedRoleOptions().length) return;
          openUserModal(null, 'create');
        });
        ui.createBtn.dataset.bound = '1';
      }
    }

    if (ui.requestBtn) {
      ui.requestBtn.style.display = requestable.length ? '' : 'none';
      if (!ui.requestBtn.dataset.bound) {
        ui.requestBtn.addEventListener('click', function() {
          if (!getRequestableRoleOptions().length) return;
          openUserModal(null, 'request');
        });
        ui.requestBtn.dataset.bound = '1';
      }
    }
  }

  users.init = function() {
    ui = {
      container: N.utils.$('#usuarios-content'),
      createBtn: N.utils.$('#create-user-btn'),
      requestBtn: N.utils.$('#request-user-btn'),
      search: N.utils.$('#user-search'),
      list: N.utils.$('#user-list'),
      requestsSection: N.utils.$('#user-requests-section'),
      requestsList: N.utils.$('#user-requests-list')
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
        var user = N.state.users.find(function(item) { return item.id === id; });

        if (action === 'edit' && user) openUserModal(user, 'edit');
        if (action === 'delete') handleDelete(id, button);
        if (action === 'reset') handleReset(id);
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

  users.render = render;
})(window.Aexfy);
