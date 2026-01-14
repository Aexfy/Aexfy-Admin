// js/staff.js

(function(N) {
  'use strict';

  if (!N) return;

  var staff = N.staff = {};
  var VIEW_ID = 'staff';
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

  function canManage() {
    var level = N.state.session && N.state.session.accessLevel;
    return level === 'owner' || level === 'manager' || level === 'hr';
  }

  function getCurrentRoles() {
    var sessionUser = N.state.session ? N.state.session.user : null;
    return N.utils.getUserRoles(sessionUser);
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

  function normalizeRut(value) {
    return N.utils.formatRUT(value || '').toUpperCase();
  }

  function isValidEmail(email) {
    var value = String(email || '').trim();
    if (!value) return false;
    if (value.indexOf(',') >= 0 || value.indexOf(';') >= 0) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function isStaffUser(user) {
    if (!user) return false;
    var meta = user.user_metadata || {};
    if (meta.user_type === 'staff') return true;
    var roles = N.utils.getUserRoles(user);
    return roles.some(function(role) { return N.config.STAFF_ROLES.indexOf(role) >= 0; });
  }

  function getStaffList() {
    return N.state.users.filter(isStaffUser);
  }

  function renderRoleOptions(container, selectedRoles, allowedRoles) {
    if (!container) return;
    if (!allowedRoles.length) {
      container.innerHTML = '<div class="text-muted">Sin permisos para asignar roles.</div>';
      return;
    }
    container.innerHTML = ROLE_OPTIONS.filter(function(option) {
      return allowedRoles.indexOf(option.value) >= 0 || selectedRoles.indexOf(option.value) >= 0;
    }).map(function(option) {
      var checked = selectedRoles.indexOf(option.value) >= 0 ? ' checked' : '';
      return (
        '<label class="role-chip">' +
          '<input type="checkbox" name="roles" value="' + option.value + '"' + checked + '>' +
          '<span>' + option.label + '</span>' +
        '</label>'
      );
    }).join('');
  }

  function lockStaffType(form) {
    if (!form) return;
    var companySection = form.querySelector('[data-company-section]');
    if (companySection) {
      companySection.style.display = 'none';
      companySection.querySelectorAll('input, select, textarea').forEach(function(input) {
        input.setAttribute('disabled', 'disabled');
      });
    }
  }

  function openStaffModal(user) {
    var isEditing = !!user;
    var template = N.utils.$('#staff-form-template');
    if (!template) return;

    var fragment = template.content.cloneNode(true);
    var form = fragment.querySelector('#staff-form');
    if (!form) return;

    var selectedRoles = isEditing ? N.utils.getUserRoles(user) : [];
    var allowedRoles = getAllowedRoleOptions();
    var prefill = null;

    if (!allowedRoles.length && N.state.session && N.state.session.accessLevel !== 'owner') {
      N.ui.showToast('No tienes permisos para asignar roles.', 'error');
      return;
    }

    if (isEditing) {
      var meta = user.user_metadata || {};
      var legacyName = splitLegacyName(meta.full_name || '');
      prefill = {
        id: user.id || '',
        first_name: meta.first_name || legacyName.first_name || '',
        middle_name: meta.middle_name || legacyName.middle_name || '',
        last_name: meta.last_name || legacyName.last_name || '',
        mother_last_name: meta.mother_last_name || legacyName.mother_last_name || '',
        rut: meta.rut ? N.utils.formatRUT(meta.rut) : '',
        email: user.email || '',
        status: user.status || 'active'
      };
    }

    var footer =
      '<div class="btn-group">' +
        '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
        '<button type="submit" form="staff-form" class="btn btn-primary">Guardar</button>' +
      '</div>';

    var overlay = N.ui.showModal(isEditing ? 'Editar staff' : 'Nuevo staff', form.outerHTML, footer);
    if (!overlay) return;

    var modalForm = N.utils.$('#staff-form');
    if (modalForm) {
      modalForm.addEventListener('submit', handleFormSubmit);
      bindNameInputs(modalForm);
      bindRutInput(modalForm);
      lockStaffType(modalForm);
      renderRoleOptions(modalForm.querySelector('[data-role-options]'), selectedRoles, allowedRoles);
      if (prefill) {
        var setValue = function(name, value) {
          var input = modalForm.querySelector('[name="' + name + '"]');
          if (input) input.value = value || '';
        };
        setValue('id', prefill.id);
        setValue('first_name', prefill.first_name);
        setValue('middle_name', prefill.middle_name);
        setValue('last_name', prefill.last_name);
        setValue('mother_last_name', prefill.mother_last_name);
        setValue('rut', prefill.rut);
        setValue('email', prefill.email);
        setValue('status', prefill.status);
        var rutInput = modalForm.querySelector('[name="rut"]');
        var emailInput = modalForm.querySelector('[name="email"]');
        if (rutInput) rutInput.setAttribute('readonly', 'readonly');
        if (emailInput) emailInput.setAttribute('readonly', 'readonly');
      }
    }

    var closeBtn = N.utils.$('[data-modal-close]', overlay);
    if (closeBtn) closeBtn.addEventListener('click', function() { N.ui.closeModal(); });
  }

  function collectRoles(form) {
    var roles = [];
    form.querySelectorAll('input[name="roles"]:checked').forEach(function(input) {
      roles.push(input.value);
    });
    return roles;
  }

  function getStaffPayload(data, roles, primaryRole) {
    return {
      first_name: sanitizeNameValue(data.first_name),
      middle_name: sanitizeNameValue(data.middle_name),
      last_name: sanitizeNameValue(data.last_name),
      mother_last_name: sanitizeNameValue(data.mother_last_name),
      full_name: buildFullName(data),
      rut: data.rut || '',
      user_type: 'staff',
      roles: roles,
      role: primaryRole
    };
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

  async function createRemoteUser(data, roles, primaryRole) {
    if (!window.supabaseClient) throw new Error('Supabase no disponible');

    var payload = {
      email: data.email,
      roles: roles,
      metadata: getStaffPayload(data, roles, primaryRole),
      user_type: 'staff',
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

  async function handleFormSubmit(event) {
    event.preventDefault();
    var form = event.target;
    var emailInput = form.querySelector('[name="email"]');
    if (form.checkValidity && !form.checkValidity()) {
      form.reportValidity();
      return;
    }
    setFormError(form, '');
    var unlock = N.utils.lockForm(form);
    if (!unlock) return;
    var data = Object.fromEntries(new FormData(form).entries());
    data.user_type = 'staff';
    var roles = collectRoles(form);
    var primaryRole = N.roles ? N.roles.getPrimaryRole(roles) : roles[0];

    data.first_name = sanitizeNameValue(data.first_name);
    data.middle_name = sanitizeNameValue(data.middle_name);
    data.last_name = sanitizeNameValue(data.last_name);
    data.mother_last_name = sanitizeNameValue(data.mother_last_name);
    data.email = N.utils.normalizeEmail(data.email);
    data.rut = normalizeRut(data.rut);

    if (!data.first_name || !data.middle_name || !data.last_name || !data.mother_last_name) {
      setFormError(form, 'Completa todos los campos de nombre y apellidos.');
      unlock();
      return;
    }

    if (!roles.length) {
      setFormError(form, 'Selecciona al menos un rol.');
      unlock();
      return;
    }

    if (!isValidEmail(data.email)) {
      setFormError(form, 'Ingresa un email valido.');
      unlock();
      return;
    }

    try {
      if (data.id) {
        var index = N.state.users.findIndex(function(item) { return item.id === data.id; });
        if (index >= 0) {
          var current = N.state.users[index];
          var existing = current.user_metadata || {};
          current.user_metadata = Object.assign({}, existing, getStaffPayload(data, roles, primaryRole));
          current.status = data.status || 'active';
          current.updated_at = N.utils.nowISO();
          N.audit.log('staff_update', { id: current.id, email: current.email });
          await N.data.saveState();
          N.ui.closeModal();
          render();
        }
        return;
      }

      var result = await createRemoteUser(data, roles, primaryRole);
      var existing = result && result.existing;
      var existingStaff = N.state.users.find(function(item) {
        return N.utils.normalizeEmail(item.email) === N.utils.normalizeEmail(data.email);
      });
      var payload = getStaffPayload(data, roles, primaryRole);
      if (existing && existingStaff) {
        existingStaff.user_metadata = Object.assign({}, existingStaff.user_metadata || {}, payload);
        existingStaff.status = data.status || existingStaff.status || 'active';
        existingStaff.updated_at = N.utils.nowISO();
        N.audit.log('staff_update', { id: existingStaff.id, email: existingStaff.email });
      } else {
        var user = result.user || {};
        var newStaff = {
          id: user.id || N.utils.uid('stf'),
          auth_id: user.id || '',
          email: data.email || user.email || '',
          status: data.status || 'active',
          user_metadata: payload,
          created_at: N.utils.nowISO()
        };
        N.state.users.push(newStaff);
        N.audit.log('staff_create', { id: newStaff.id, email: newStaff.email });
      }
      await N.data.saveState();
      var invited = result && result.invited;
      N.ui.showToast(invited ? 'Invitacion enviada' : 'Staff creado', 'success');
      N.ui.closeModal();
      render();
    } catch (_err) {
      N.ui.showToast('No fue posible crear el staff.', 'error');
    } finally {
      unlock();
    }
  }

  async function handleDelete(staffId, button) {
    var staffUser = N.state.users.find(function(item) { return item.id === staffId; });
    if (!staffUser) return;
    if (!window.confirm('Eliminar este staff del estado?')) return;

    var unlock = N.utils.lockButton(button);
    if (!unlock) return;
    try {
      await deleteRemoteUser(staffUser);
      N.state.users = N.state.users.filter(function(item) { return item.id !== staffId; });
      N.audit.log('staff_delete', { id: staffId, email: staffUser.email });
      await N.data.saveState();
      render();
    } catch (_err) {
      N.ui.showToast('No fue posible eliminar el staff.', 'error');
    } finally {
      unlock();
    }
  }

  function render(dataToRender) {
    if (!ui.container) return;

    var list = Array.isArray(dataToRender) ? dataToRender : getStaffList();
    N.ui.setViewTitle('Staff');
    N.ui.setActiveNav(VIEW_ID);

    var columns = [
      { key: 'user_metadata.full_name', label: 'Nombre' },
      { key: 'email', label: 'Email' },
      { key: 'roles', label: 'Roles', formatter: function(_, row) {
        var roles = N.utils.getUserRoles(row);
        return roles.length ? N.utils.getRoleLabel(roles) : '-';
      } },
      { key: 'status', label: 'Estado', formatter: function(value) {
        return '<span class="status status-' + value + '">' + N.utils.escapeHtml(N.utils.getStatusLabel(value)) + '</span>';
      } }
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

    N.ui.renderTable('#staff-list', columns, list, {
      emptyState: {
        title: 'Sin staff',
        message: 'No hay miembros de staff registrados.'
      }
    });
  }

  function handleSearch(event) {
    var term = event.target.value.trim().toLowerCase();
    if (!term) {
      render();
      return;
    }

    var filtered = getStaffList().filter(function(user) {
      var name = user.user_metadata && user.user_metadata.full_name ? user.user_metadata.full_name.toLowerCase() : '';
      var email = (user.email || '').toLowerCase();
      var roles = N.utils.getUserRoles(user).join(' ').toLowerCase();
      return name.indexOf(term) >= 0 || email.indexOf(term) >= 0 || roles.indexOf(term) >= 0;
    });

    render(filtered);
  }

  staff.init = function() {
    ui = {
      container: N.utils.$('#staff-content'),
      createBtn: N.utils.$('#create-staff-btn'),
      search: N.utils.$('#staff-search'),
      list: N.utils.$('#staff-list')
    };

    if (!ui.container) return;

    var allowed = getAllowedRoleOptions();

    if (ui.createBtn) {
      ui.createBtn.style.display = allowed.length ? '' : 'none';
      if (allowed.length) {
        ui.createBtn.addEventListener('click', function() { openStaffModal(null); });
      }
    }

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
        var staffUser = N.state.users.find(function(item) { return item.id === id; });

        if (action === 'edit' && staffUser) openStaffModal(staffUser);
        if (action === 'delete') handleDelete(id, button);
      });
    }

    document.addEventListener('state:updated', function() {
      render();
    });
  };

  staff.render = render;
})(window.Aexfy);
