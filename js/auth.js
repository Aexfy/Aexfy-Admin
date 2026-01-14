// js/auth.js
// Authentication, session management, and access control.

(function(N) {
  'use strict';

  if (!N) return;

  var auth = N.auth = {};
  var ui = {};
  var sessionSyncInProgress = false;
  var sessionBlockInProgress = false;

  function getAccessLevel(user) {
    if (!user) return 'none';
    var email = N.utils.normalizeEmail(user.email);
    var roles = N.utils.getUserRoles(user);
    var userType = user.user_metadata && user.user_metadata.user_type ? user.user_metadata.user_type : '';

    if (N.config.MEGA_SUPERUSER_EMAILS.indexOf(email) >= 0 || roles.indexOf(N.config.OWNER_ROLE) >= 0) {
      return 'owner';
    }
    if (roles.indexOf(N.config.MANAGER_ROLE) >= 0 || roles.indexOf(N.config.SUPERUSER_ROLE) >= 0 || N.config.SUPERUSER_EMAILS.indexOf(email) >= 0) {
      return 'manager';
    }
    if (roles.indexOf(N.config.SUPERVISOR_ROLE) >= 0 || roles.indexOf('seller_manager') >= 0) {
      return 'supervisor';
    }
    if (roles.some(function(role) { return N.config.SELLER_ROLES.indexOf(role) >= 0; })) {
      return 'seller';
    }
    if (roles.some(function(role) { return N.config.SUPPORT_ROLES.indexOf(role) >= 0; })) {
      return 'support';
    }
    if (roles.some(function(role) { return N.config.HR_ROLES.indexOf(role) >= 0; })) {
      return 'hr';
    }
    if (roles.indexOf('instalador') >= 0) {
      return 'installer';
    }
    if (roles.indexOf('capacitador') >= 0) {
      return 'trainer';
    }
    if (userType === 'cliente') {
      return 'client';
    }
    return 'none';
  }

  function setViewVisibility(isAuthenticated) {
    var loginScreen = N.utils.$('#login-screen');
    var appShell = N.utils.$('#app-shell');

    if (loginScreen) {
      loginScreen.style.display = isAuthenticated ? 'none' : 'flex';
    }
    if (appShell && loginScreen) {
      appShell.style.display = isAuthenticated ? 'flex' : 'none';
    }
    document.body.classList.toggle('is-authenticated', !!isAuthenticated);
  }

  function updateSessionUI(user) {
    var emailEl = N.utils.$('#session-email');
    var roleEl = N.utils.$('#session-role');
    var roles = user ? N.utils.getUserRoles(user) : [];
    var email = user ? N.utils.normalizeEmail(user.email) : '';
    if (!roles.length && email && N.config.MEGA_SUPERUSER_EMAILS.indexOf(email) >= 0) {
      roles = [N.config.OWNER_ROLE];
    }

    if (emailEl) emailEl.textContent = user ? user.email : '-';
    if (roleEl) roleEl.textContent = roles.length ? N.utils.getRoleLabel(roles) : '-';
  }

  function parseAccessList(value) {
    if (!value) return [];
    return value.split(',').map(function(item) {
      return item.trim();
    }).filter(Boolean);
  }

  function isAllowed(accessLevel, allowed) {
    if (!allowed.length) return true;
    if (accessLevel === 'owner') return true;
    return allowed.indexOf(accessLevel) >= 0;
  }

  function updateNavVisibility(accessLevel) {
    var aliases = {
      super: ['owner', 'manager'],
      seller: ['owner', 'manager', 'supervisor', 'seller']
    };

    N.utils.$$('.sidebar-nav [data-role-required]').forEach(function(item) {
      var required = item.getAttribute('data-role-required');
      var allowed = aliases[required] ? aliases[required] : parseAccessList(required);
      item.style.display = isAllowed(accessLevel, allowed) ? '' : 'none';
    });
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  function normalizeRoleList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function(role) {
      return String(role || '').trim().toLowerCase();
    }).filter(Boolean);
  }

  function rolesMatch(a, b) {
    var left = normalizeRoleList(a).sort().join(',');
    var right = normalizeRoleList(b).sort().join(',');
    return left === right;
  }

  function getStateStatus(user) {
    if (!user) return '';
    var raw = user.status || (user.user_metadata && user.user_metadata.status) || '';
    return String(raw || '').trim().toLowerCase();
  }

  function isActiveStatus(status) {
    return !status || status === 'active' || status === 'activo';
  }

  function getStateUser(sessionUser) {
    if (!sessionUser || !Array.isArray(N.state.users) || !N.state.users.length) return null;
    var sessionId = sessionUser.id || '';
    var sessionEmail = N.utils.normalizeEmail(sessionUser.email || '');
    return N.state.users.find(function(item) {
      if (!item) return false;
      if (item.auth_id && sessionId && item.auth_id === sessionId) return true;
      if (item.id && sessionId && isUuid(sessionId) && item.id === sessionId) return true;
      var itemEmail = N.utils.normalizeEmail(item.email || '');
      return sessionEmail && itemEmail && sessionEmail === itemEmail;
    }) || null;
  }

  function getLandingPage(accessLevel) {
    if (accessLevel === 'owner' || accessLevel === 'manager') return 'superusuario.html';
    if (accessLevel === 'supervisor' || accessLevel === 'seller') return 'vendedor.html';
    if (accessLevel === 'support') return 'soporte.html';
    if (accessLevel === 'hr') return 'staff.html';
    if (accessLevel === 'installer' || accessLevel === 'trainer') return 'panel.html';
    return 'login.html';
  }

  function redirectToLanding(accessLevel) {
    if (!accessLevel || accessLevel === 'none') {
      auth.logout();
      return;
    }
    var landing = getLandingPage(accessLevel);
    if (landing === 'login.html') {
      auth.logout();
      return;
    }
    var current = window.location.pathname.split('/').pop();
    if (current !== landing) {
      window.location.href = landing;
    }
  }

  function enforcePageAccess(accessLevel) {
    var required = document.body.dataset.access || '';
    if (!required || required === 'login' || required === 'password' || required === 'general') return;
    var allowedList = parseAccessList(required);
    if (!allowedList.length) return;
    if (!isAllowed(accessLevel, allowedList)) {
      redirectToLanding(accessLevel);
    }
  }

  async function blockSession(message) {
    if (sessionBlockInProgress) return;
    sessionBlockInProgress = true;
    if (N.ui && N.ui.showToast && message) {
      N.ui.showToast(message, 'error');
    }
    await auth.logout();
  }

  async function syncSessionWithState(source) {
    if (sessionSyncInProgress) return;
    if (!N.state || !N.state.session || !N.state.session.user) return;
    if (!N.state.isReady) return;
    if (!Array.isArray(N.state.users) || !N.state.users.length) return;

    sessionSyncInProgress = true;
    try {
      var sessionUser = N.state.session.user;
      var stateUser = getStateUser(sessionUser);
      var sessionEmail = N.utils.normalizeEmail(sessionUser.email || '');
      var isOwner = sessionEmail && N.config.MEGA_SUPERUSER_EMAILS.indexOf(sessionEmail) >= 0;

      if (!stateUser && !isOwner) {
        await blockSession('Tu acceso fue revocado.');
        return;
      }

      if (stateUser) {
        var status = getStateStatus(stateUser);
        if (!isActiveStatus(status)) {
          await blockSession('Tu acceso fue deshabilitado.');
          return;
        }
      }

      var stateRoles = stateUser ? N.utils.getUserRoles(stateUser) : [];
      var sessionRoles = N.utils.getUserRoles(sessionUser);
      var nextRoles = stateRoles.length ? stateRoles : sessionRoles;
      var rolesChanged = !rolesMatch(nextRoles, sessionRoles);
      var stateUserType = stateUser && stateUser.user_metadata ? stateUser.user_metadata.user_type : '';
      var sessionUserType = sessionUser.user_metadata ? sessionUser.user_metadata.user_type : '';
      var userTypeChanged = stateUserType && stateUserType !== sessionUserType;

      if (rolesChanged || userTypeChanged) {
        var meta = sessionUser.user_metadata || {};
        var stateMeta = stateUser ? (stateUser.user_metadata || {}) : {};
        meta.roles = nextRoles;
        meta.role = N.roles ? N.roles.getPrimaryRole(nextRoles) : (nextRoles[0] || meta.role);
        meta.user_type = stateMeta.user_type || meta.user_type || (nextRoles.indexOf('cliente') >= 0 ? 'cliente' : 'staff');
        sessionUser.user_metadata = meta;
      }

      if (rolesChanged || userTypeChanged) {
        var accessLevel = getAccessLevel(sessionUser);
        N.state.session.accessLevel = accessLevel;
        N.state.session.accessRoles = nextRoles;
        N.state.session.primaryRole = N.roles ? N.roles.getPrimaryRole(nextRoles) : '';
        updateSessionUI(sessionUser);
        updateNavVisibility(accessLevel);
        if (N.app && typeof N.app.refreshModules === 'function') {
          N.app.refreshModules();
        }
        enforcePageAccess(accessLevel);
      }
    } finally {
      sessionSyncInProgress = false;
    }
  }

  function handleAccessRedirect(accessLevel, requiredAccess) {
    if (!requiredAccess) return;
    if (requiredAccess === 'login' || requiredAccess === 'password') return;

    if (requiredAccess === 'general') {
      var landing = 'panel.html';
      if (accessLevel === 'owner' || accessLevel === 'manager') {
        landing = 'superusuario.html';
      } else if (accessLevel === 'supervisor' || accessLevel === 'seller') {
        landing = 'vendedor.html';
      } else if (accessLevel === 'support') {
        landing = 'soporte.html';
      } else if (accessLevel === 'hr') {
        landing = 'staff.html';
      }
      window.location.href = landing;
      return;
    }

    var allowedList = parseAccessList(requiredAccess);
    if (allowedList.length) {
      if (!isAllowed(accessLevel, allowedList)) {
        redirectToLanding(accessLevel);
      }
      return;
    }

    if (requiredAccess === 'super') {
      if (accessLevel !== 'manager' && accessLevel !== 'owner') {
        redirectToLanding(accessLevel);
      }
      return;
    }

    if (requiredAccess === 'seller') {
      if (accessLevel !== 'seller' && accessLevel !== 'supervisor' && accessLevel !== 'manager' && accessLevel !== 'owner') {
        redirectToLanding(accessLevel);
      }
    }
  }

  async function handleAuthStateChange(event, session) {
    N.state.session = session;

    if ((event === 'SIGNED_IN' || event === 'SESSION_RESTORE') && session) {
      var user = session.user;
      var roles = N.utils.getUserRoles(user);
      var accessLevel = getAccessLevel(user);
      N.state.session.accessLevel = accessLevel;
      N.state.session.accessRoles = roles;
      N.state.session.primaryRole = N.roles ? N.roles.getPrimaryRole(roles) : '';

      setViewVisibility(true);
      updateSessionUI(user);
      updateNavVisibility(accessLevel);

      if (N.data && typeof N.data.bootstrapState === 'function') {
        N.data.bootstrapState({ background: true });
      }
      document.dispatchEvent(new CustomEvent('state:updated'));

      var accessMode = document.body.dataset.access || '';
      handleAccessRedirect(accessLevel, accessMode);

      if (event === 'SIGNED_IN' && N.audit && N.audit.log) {
        N.audit.log('user_login', { email: user.email });
      }

      syncSessionWithState('auth');
      return;
    }

    if (event === 'SIGNED_OUT') {
      setViewVisibility(false);
      updateSessionUI(null);
      N.state.session = null;
      sessionBlockInProgress = false;
      if (N.data && typeof N.data.clearCache === 'function') {
        N.data.clearCache();
      }

      if (!window.location.pathname.toLowerCase().includes('login.html')) {
        window.location.href = 'login.html';
      }
    }
  }

  auth.login = async function(email, password) {
    if (!window.supabaseClient) return;

    if (ui.loginSubmit) ui.loginSubmit.disabled = true;
    if (ui.loginError) ui.loginError.textContent = '';

    try {
      var response = await window.supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (response.error) throw response.error;
    } catch (err) {
      if (ui.loginError) {
        ui.loginError.textContent = 'Email o contrasena incorrectos. Intenta de nuevo.';
      }
      if (ui.loginSubmit) ui.loginSubmit.disabled = false;
    }
  };

  auth.logout = async function() {
    if (!window.supabaseClient) return;
    await window.supabaseClient.auth.signOut();
  };

  auth.hasAccess = function(list) {
    var accessLevel = N.state.session ? N.state.session.accessLevel : 'none';
    var allowed = parseAccessList(list);
    return isAllowed(accessLevel, allowed);
  };

  auth.syncSessionWithState = syncSessionWithState;

  auth.recoverPassword = async function(email, rut) {
    if (!window.supabaseClient) return;
    if (ui.recoveryStatus) ui.recoveryStatus.textContent = 'Verificando...';
    if (ui.recoverySubmit) ui.recoverySubmit.disabled = true;

    if (!N.state.users.length) {
      try {
        var stateRow = await window.supabaseClient
          .from(N.config.STATE_TABLE)
          .select('id, users')
          .eq('id', N.config.STATE_ROW_ID)
          .single();
        if (stateRow && stateRow.data && Array.isArray(stateRow.data.users)) {
          N.state.users = stateRow.data.users;
        }
      } catch (err) {
        // Ignore and continue with current state.
      }
    }

    var match = N.state.users.find(function(user) {
      var userEmail = N.utils.normalizeEmail(user.email);
      var userRut = N.utils.formatRUT(user.rut || user.user_metadata && user.user_metadata.rut || '');
      return userEmail === N.utils.normalizeEmail(email) && userRut === N.utils.formatRUT(rut);
    });

    if (!match) {
      if (ui.recoveryStatus) {
        ui.recoveryStatus.textContent = 'Si los datos son correctos, recibiras un email con instrucciones.';
      }
      return;
    }

    try {
      var redirectUrl = new URL('crear-contrasena.html', window.location.href);
      if (match && match.id) {
        redirectUrl.searchParams.set('uid', match.id);
      }
      var resetResponse = await window.supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl.href
      });
      if (resetResponse.error) throw resetResponse.error;

      if (ui.recoveryStatus) {
        ui.recoveryStatus.textContent = 'Revisa tu email para continuar con el cambio de contrasena.';
      }
    } catch (err) {
      if (ui.recoveryStatus) {
        ui.recoveryStatus.textContent = 'No fue posible iniciar la recuperacion. Intenta mas tarde.';
      }
    }
  };

  auth.init = function() {
    ui = {
      loginForm: N.utils.$('#login-form'),
      loginEmail: N.utils.$('#login-email'),
      loginPassword: N.utils.$('#login-password'),
      loginSubmit: N.utils.$('#login-submit'),
      loginError: N.utils.$('#login-error'),
      logoutBtn: N.utils.$('#logout-btn'),
      loginRecoveryToggle: N.utils.$('#login-recovery-toggle'),
      loginRecovery: N.utils.$('#login-recovery'),
      recoveryForm: N.utils.$('#recovery-form'),
      recoveryEmail: N.utils.$('#recovery-email'),
      recoveryRut: N.utils.$('#recovery-rut'),
      recoverySubmit: N.utils.$('#recovery-submit'),
      recoveryStatus: N.utils.$('#recovery-status'),
      recoveryCancel: N.utils.$('#recovery-cancel')
    };

    if (ui.loginForm) {
      ui.loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        auth.login(ui.loginEmail.value, ui.loginPassword.value);
      });
    }

    if (ui.logoutBtn) {
      ui.logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        auth.logout();
      });
    }

    if (ui.loginRecoveryToggle && ui.loginRecovery) {
      ui.loginRecoveryToggle.addEventListener('click', function(e) {
        e.preventDefault();
        if (ui.loginForm) ui.loginForm.style.display = 'none';
        ui.loginRecovery.style.display = 'block';
      });
    }

    if (ui.recoveryCancel && ui.loginRecovery) {
      ui.recoveryCancel.addEventListener('click', function(e) {
        e.preventDefault();
        ui.loginRecovery.style.display = 'none';
        if (ui.loginForm) ui.loginForm.style.display = 'block';
        if (ui.recoveryStatus) ui.recoveryStatus.textContent = '';
        if (ui.recoverySubmit) ui.recoverySubmit.disabled = false;
      });
    }

    if (ui.recoveryForm) {
      ui.recoveryForm.addEventListener('submit', function(e) {
        e.preventDefault();
        auth.recoverPassword(ui.recoveryEmail.value, ui.recoveryRut.value);
      });
    }

    if (!window.supabaseClient) return;

    window.supabaseClient.auth.onAuthStateChange(handleAuthStateChange);
    document.addEventListener('state:updated', function() {
      syncSessionWithState('state');
    });

    window.supabaseClient.auth.getSession().then(async function(result) {
      var path = window.location.pathname.toLowerCase();
      var isAuthPage = path.includes('login.html') || path.includes('crear-contrasena.html');

      if (result && result.data && result.data.session) {
        try {
          var userResult = await window.supabaseClient.auth.getUser();
          if (!userResult || userResult.error || !userResult.data || !userResult.data.user) {
            await window.supabaseClient.auth.signOut();
            setViewVisibility(false);
            if (!isAuthPage) {
              window.location.href = 'login.html';
            }
            return;
          }
        } catch (_err) {
          await window.supabaseClient.auth.signOut();
          setViewVisibility(false);
          if (!isAuthPage) {
            window.location.href = 'login.html';
          }
          return;
        }
        handleAuthStateChange('SESSION_RESTORE', result.data.session);
      } else {
        setViewVisibility(false);
        if (!isAuthPage) {
          window.location.href = 'login.html';
        }
      }
    });
  };
})(window.Aexfy);

