// js/core.js
// Global namespace, config, state, utils, and data layer.

(function() {
  'use strict';

  var N = window.Aexfy = window.Aexfy || {};

  N.config = {
    SUPERUSER_ROLE: 'superadmin',
    OWNER_ROLE: 'ownaexfy',
    MANAGER_ROLE: 'gerente',
    SUPERVISOR_ROLE: 'supervisor',
    MEGA_SUPERUSER_EMAILS: [
      'aexfytech@gmail.com',
      'aexfytech@outlook.com',
      'aexfytech@outlook.cl',
      'aexfy.tech@outlook.cl'
    ],
    SUPERUSER_EMAILS: [],
    SUPPORT_ROLES: ['jefe_soporte', 'soporte'],
    HR_ROLES: ['jefe_rrhh', 'rrhh'],
    SALES_ROLES: ['supervisor', 'vendedor', 'instalador', 'capacitador'],
    SELLER_ROLES: ['vendedor', 'seller', 'seller_manager'],
    STAFF_ROLES: ['jefe_soporte', 'soporte', 'jefe_rrhh', 'rrhh', 'staff', 'support', 'developer'],
    ZONE_ROLES: ['supervisor', 'vendedor', 'instalador', 'capacitador'],
    ZONE_OPTIONS: [
      { id: 'NG', label: 'Zona 1 - Norte Grande' },
      { id: 'NC', label: 'Zona 2 - Norte Chico' },
      { id: 'CT', label: 'Zona 3 - Centro' },
      { id: 'SR', label: 'Zona 4 - Sur' },
      { id: 'AU', label: 'Zona 5 - Austral' }
    ],

    STATE_TABLE: 'aexfy_admin_state',
    STATE_ROW_ID: 'main',
    REMOTE_ENABLED: true,
    REALTIME_ENABLED: true,
    USE_EDGE_STATE: true,
    POLL_INTERVAL_MS: 15000,
    REQUEST_TIMEOUT_MS: 8000,
    EDGE_TIMEOUT_MS: 6000,
    TABLE_TIMEOUT_MS: 6000,
    PREFER_TABLE_READ: false,
    LOADING_GRACE_MS: 350,
    SHOW_LOADING: false,
    DEBUG_LOGS: false,
    POLL_WHEN_REALTIME: true,
    FOCUS_REFRESH_MS: 5000,
    CACHE_ENABLED: true,
    CACHE_KEY: 'aexfy_admin_cache',
    CACHE_TTL_MS: 300000
    ,
    SUPABASE_EMAIL_FUNCTION: ''
  };

  N.state = {
    isReady: false,
    isLoading: false,
    isSaving: false,
    lastSyncAt: null,
    companies: [],
    users: [],
    meta: {
      supportTemplates: [],
      productLibrary: [],
      productTemplates: [],
      auditLog: [],
      userRequests: [],
      companyRequests: [],
      notifications: []
    },
    session: null
  };

  N.audit = N.audit || {
    log: function() {}
  };

  N.roles = {
    ROLE_LABELS: {
      ownaexfy: 'OwnAexfy',
      gerente: 'Gerente',
      superadmin: 'Gerente',
      jefe_soporte: 'Jefe de soporte',
      soporte: 'Soporte',
      jefe_rrhh: 'Jefe RRHH',
      rrhh: 'RRHH',
      supervisor: 'Supervisor',
      vendedor: 'Vendedor',
      seller: 'Vendedor',
      seller_manager: 'Supervisor',
      instalador: 'Instalador',
      capacitador: 'Capacitador',
      cliente: 'Cliente',
      client: 'Cliente',
      staff: 'Staff',
      support: 'Soporte',
      developer: 'Developer'
    },
    ROLE_ORDER: [
      'ownaexfy',
      'gerente',
      'superadmin',
      'supervisor',
      'seller_manager',
      'vendedor',
      'seller',
      'instalador',
      'capacitador',
      'jefe_soporte',
      'soporte',
      'jefe_rrhh',
      'rrhh',
      'cliente',
      'client',
      'staff',
      'support',
      'developer'
    ],
    getUserRoles: function(user) {
      if (!user) return [];
      var meta = user.user_metadata || {};
      var roles = [];
      if (Array.isArray(meta.roles)) {
        roles = meta.roles;
      } else if (meta.role) {
        roles = [meta.role];
      }
      return roles.map(function(role) {
        return String(role || '').trim().toLowerCase();
      }).filter(Boolean);
    },
    getPrimaryRole: function(roles) {
      if (!Array.isArray(roles) || !roles.length) return '';
      var order = {};
      N.roles.ROLE_ORDER.forEach(function(role, index) {
        order[role] = index;
      });
      var best = roles[0];
      var bestRank = order[best] !== undefined ? order[best] : 999;
      roles.forEach(function(role) {
        var rank = order[role] !== undefined ? order[role] : 999;
        if (rank < bestRank) {
          best = role;
          bestRank = rank;
        }
      });
      return best;
    },
    getAllowedAssignments: function(roles) {
      if (!Array.isArray(roles) || !roles.length) return [];
      var has = function(role) { return roles.indexOf(role) >= 0; };
      var allRoles = [
        'ownaexfy',
        'gerente',
        'jefe_soporte',
        'soporte',
        'jefe_rrhh',
        'rrhh',
        'supervisor',
        'instalador',
        'vendedor',
        'capacitador',
        'cliente'
      ];

      if (has('ownaexfy')) return allRoles.slice();
      if (has('gerente') || has('superadmin')) {
        return allRoles.filter(function(role) {
          return role !== 'ownaexfy' && role !== 'gerente';
        });
      }
      if (has('supervisor')) return ['instalador', 'vendedor', 'capacitador'];
      if (has('jefe_soporte') || has('soporte')) return ['soporte'];
      if (has('jefe_rrhh') || has('rrhh')) return ['rrhh'];
      return [];
    },
    getRequestableRoles: function(roles) {
      if (!Array.isArray(roles) || !roles.length) return [];
      var has = function(role) { return roles.indexOf(role) >= 0; };
      if (has('vendedor')) return ['cliente'];
      return [];
    }
  };

  N.utils = {
    $: function(selector, root) {
      return (root || document).querySelector(selector);
    },
    $$: function(selector, root) {
      return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    },
    normalizeEmail: function(email) {
      return (email || '').trim().toLowerCase();
    },
    safeText: function(value, fallback) {
      if (value === 0) return '0';
      if (!value) return fallback || '';
      return String(value);
    },
    escapeHtml: function(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    uid: function(prefix) {
      var base = Math.random().toString(36).slice(2, 8);
      var stamp = Date.now().toString(36);
      return (prefix ? prefix + '_' : '') + stamp + base;
    },
    formatRUT: function(rut) {
      if (!rut) return '';
      var cleaned = String(rut).replace(/[^0-9kK]/g, '').toUpperCase();
      if (cleaned.length > 9) {
        cleaned = cleaned.slice(0, 9);
      }
      if (cleaned.length < 2) return cleaned;
      var body = cleaned.slice(0, -1);
      var dv = cleaned.slice(-1);
      var formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return formatted + '-' + dv;
    },
    formatPhone: function(phone) {
      if (!phone) return '';
      var cleaned = String(phone).replace(/\D/g, '');
      if (cleaned.length === 11 && cleaned.indexOf('569') === 0) {
        return '+56 9 ' + cleaned.slice(3, 7) + ' ' + cleaned.slice(7);
      }
      return phone;
    },
    getRoleLabel: function(role) {
      if (Array.isArray(role)) {
        return role.map(function(item) {
          return N.utils.getRoleLabel(item);
        }).join(', ');
      }
      var key = String(role || '').trim().toLowerCase();
      var label = N.roles && N.roles.ROLE_LABELS ? N.roles.ROLE_LABELS[key] : '';
      return label || role || 'Sin rol';
    },
    getUserRoles: function(user) {
      return N.roles ? N.roles.getUserRoles(user) : [];
    },
    getStatusLabel: function(status) {
      var labels = {
        active: 'Activo',
        pending: 'Pendiente',
        blocked: 'Bloqueado',
        disabled: 'Deshabilitado',
        trial: 'Prueba',
        expired: 'Vencido',
        approved: 'Aprobado',
        rejected: 'Rechazado'
      };
      return labels[status] || status || 'Sin estado';
    },
    normalizeRegion: function(value) {
      var text = String(value || '').trim().toLowerCase();
      if (!text) return '';
      try {
        text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      } catch (_err) {
        // Ignore normalization errors.
      }
      text = text.replace(/[^a-z0-9\s]/g, ' ');
      text = text.replace(/\s+/g, ' ').trim();
      return text;
    },
    getZonePrefixFromRegion: function(region) {
      var normalized = N.utils.normalizeRegion(region);
      if (!normalized) return '';
      var compact = normalized.replace(/\s/g, '');
      var rules = [
        { id: 'NG', regions: ['arica y parinacota', 'tarapaca', 'antofagasta'] },
        { id: 'NC', regions: ['atacama', 'coquimbo'] },
        { id: 'CT', regions: ['valparaiso', 'metropolitana', 'ohiggins', 'maule'] },
        { id: 'SR', regions: ['nuble', 'biobio', 'la araucania', 'los rios'] },
        { id: 'AU', regions: ['los lagos', 'aysen', 'magallanes'] }
      ];
      for (var i = 0; i < rules.length; i += 1) {
        var rule = rules[i];
        var match = rule.regions.some(function(name) {
          var compactName = name.replace(/\s/g, '');
          return normalized === name ||
            normalized.indexOf(name) >= 0 ||
            compact === compactName ||
            compact.indexOf(compactName) >= 0;
        });
        if (match) return rule.id;
      }
      return '';
    },
    normalizeZones: function(zones) {
      if (!zones) return [];
      var list = [];
      if (Array.isArray(zones)) {
        list = zones;
      } else if (typeof zones === 'string') {
        list = zones.split(',');
      } else {
        list = [zones];
      }
      var allowed = {};
      (N.config.ZONE_OPTIONS || []).forEach(function(item) {
        allowed[item.id] = true;
      });
      return list.map(function(zone) {
        return String(zone || '').trim().toUpperCase();
      }).filter(function(zone) {
        return zone && allowed[zone];
      });
    },
    getZoneOptions: function() {
      return Array.isArray(N.config.ZONE_OPTIONS) ? N.config.ZONE_OPTIONS.slice() : [];
    },
    getUserZones: function(user) {
      if (!user || !user.user_metadata) return [];
      var meta = user.user_metadata || {};
      return N.utils.normalizeZones(meta.zones || meta.zone || meta.zona || []);
    },
    getCompanyZonePrefix: function(company) {
      if (!company) return '';
      var code = String(company.company_code || company.id || '').toUpperCase();
      var match = code.match(/^(NG|NC|CT|SR|AU)-/);
      if (match) return match[1];
      var region = company.region || '';
      return N.utils.getZonePrefixFromRegion(region);
    },
    isZoneRestrictedSession: function() {
      var session = N.state.session;
      if (!session || !session.user) return false;
      var level = session.accessLevel;
      if (level === 'owner' || level === 'manager') return false;
      var roles = N.utils.getUserRoles(session.user);
      var restricted = N.config.ZONE_ROLES || [];
      return roles.some(function(role) { return restricted.indexOf(role) >= 0; });
    },
    getSessionZones: function() {
      var session = N.state.session;
      if (!session || !session.user) return [];
      return N.utils.getUserZones(session.user);
    },
    filterCompaniesByZones: function(companies, zones) {
      if (!Array.isArray(companies)) return [];
      if (!zones || !zones.length) return [];
      var allowed = {};
      zones.forEach(function(zone) { allowed[zone] = true; });
      return companies.filter(function(company) {
        var prefix = N.utils.getCompanyZonePrefix(company);
        return !!allowed[prefix];
      });
    },
    filterCompaniesByAccess: function(companies) {
      if (!Array.isArray(companies)) return [];
      if (!N.utils.isZoneRestrictedSession()) return companies;
      var zones = N.utils.getSessionZones();
      return N.utils.filterCompaniesByZones(companies, zones);
    },
    userMatchesZones: function(user, zones, companies) {
      if (!user) return false;
      var allowed = {};
      zones.forEach(function(zone) { allowed[zone] = true; });
      var meta = user.user_metadata || {};
      var userZones = N.utils.normalizeZones(meta.zones || meta.zone || meta.zona || []);
      if (userZones.length) {
        return userZones.some(function(zone) { return allowed[zone]; });
      }
      var userRoles = N.utils.getUserRoles(user);
      var isClient = meta.user_type === 'cliente' || userRoles.indexOf('cliente') >= 0 || userRoles.indexOf('client') >= 0;
      if (!isClient) return false;
      var companyCode = meta.company_code || '';
      if (!companyCode && meta.company_id && Array.isArray(companies)) {
        var company = companies.find(function(item) { return item.id === meta.company_id; });
        if (company && company.company_code) {
          companyCode = company.company_code;
        }
      }
      var match = String(companyCode || '').toUpperCase().match(/^(NG|NC|CT|SR|AU)-/);
      return match ? !!allowed[match[1]] : false;
    },
    filterUsersByAccess: function(users) {
      if (!Array.isArray(users)) return [];
      if (!N.utils.isZoneRestrictedSession()) return users;
      var zones = N.utils.getSessionZones();
      if (!zones.length) return [];
      return users.filter(function(user) {
        return N.utils.userMatchesZones(user, zones, N.state.companies || []);
      });
    },
    debounce: function(fn, wait) {
      var timer = null;
      return function() {
        var args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function() {
          fn.apply(null, args);
        }, wait);
      };
    },
    getSubmitButtons: function(form) {
      if (!form) return [];
      var buttons = Array.prototype.slice.call(form.querySelectorAll('button[type="submit"], input[type="submit"]'));
      var formId = form.getAttribute('id');
      if (formId) {
        var external = Array.prototype.slice.call(document.querySelectorAll('[form="' + formId + '"][type="submit"]'));
        external.forEach(function(button) {
          if (buttons.indexOf(button) === -1) buttons.push(button);
        });
      }
      return buttons;
    },
    lockForm: function(form) {
      if (!form) return null;
      if (form.dataset.submitting === '1') return null;
      form.dataset.submitting = '1';
      var buttons = N.utils.getSubmitButtons(form);
      buttons.forEach(function(button) { button.disabled = true; });
      return function unlock() {
        form.dataset.submitting = '0';
        buttons.forEach(function(button) { button.disabled = false; });
      };
    },
    lockButton: function(button) {
      if (!button) return null;
      if (button.dataset.locked === '1') return null;
      button.dataset.locked = '1';
      button.disabled = true;
      return function unlock() {
        button.dataset.locked = '0';
        button.disabled = false;
      };
    },
    nowISO: function() {
      return new Date().toISOString();
    }
  };

  N.notifications = {
    _initialized: false,
    _container: null,
    init: function() {
      if (this._initialized) return;
      var container = N.utils.$('#zone-alerts');
      if (!container) {
        container = document.createElement('div');
        container.id = 'zone-alerts';
        document.body.appendChild(container);
      }
      this._container = container;
      document.addEventListener('state:updated', this.render.bind(this));
      this.render();
      this._initialized = true;
    },
    ensureMeta: function() {
      if (!N.state.meta) N.state.meta = {};
      if (!Array.isArray(N.state.meta.notifications)) {
        N.state.meta.notifications = [];
      }
    },
    notifyZoneSupervisors: function(type, message, metadata, zones) {
      this.ensureMeta();
      var normalizedZones = N.utils.normalizeZones(zones || (metadata && metadata.zones) || []);
      var supervisors = this.getSupervisors(normalizedZones);
      if (!supervisors.length) return;
      var subject = (metadata && metadata.subject) ? metadata.subject : 'Nueva solicitud de zona';
      var link = (metadata && metadata.link) ? metadata.link : '';
      var now = N.utils.nowISO();
      supervisors.forEach(function(supervisor) {
        var notification = {
          id: N.utils.uid('notification'),
          type: type,
          recipient_email: (supervisor.email || '').toLowerCase(),
          zones: normalizedZones,
          message: message,
          data: Object.assign({}, metadata || {}, { link: link }),
          created_at: now,
          read: false
        };
        N.state.meta.notifications.push(notification);
        if (N.state.session && N.state.session.user && (N.state.session.user.email || '').toLowerCase() === notification.recipient_email) {
          if (N.ui && typeof N.ui.showToast === 'function') {
            N.ui.showToast('Nueva solicitud: ' + message, 'info', 5000);
          }
        }
      });
      this.sendEmail(supervisors.map(function(item) { return item.email; }), subject, message, link);
      N.data.saveState({ silent: true });
      this.render();
    },
    getSupervisors: function(zones) {
      zones = N.utils.normalizeZones(zones || []);
      return (N.state.users || []).filter(function(user) {
        var roles = N.utils.getUserRoles(user);
        if (roles.indexOf('supervisor') < 0) return false;
        if (!zones.length) return true;
        return N.utils.userMatchesZones(user, zones, N.state.companies || []);
      });
    },
    sendEmail: async function(recipients, subject, message, link) {
      if (!window.supabaseClient) return;
      var functionName = N.config.SUPABASE_EMAIL_FUNCTION;
      if (!functionName || typeof functionName !== 'string') return;
      try {
        await window.supabaseClient.functions.invoke(functionName, {
          body: {
            recipients: recipients.filter(Boolean),
            subject: subject,
            body: message + (link ? '\n\nRevisa: ' + link : '')
          }
        });
      } catch (_err) {
        if (N.config.DEBUG_LOGS) {
          console.warn('Email notification fallido', _err);
        }
      }
    },
    render: function() {
      var container = this._container;
      if (!container) {
        this._initialized = false;
        this.init();
        container = this._container;
        if (!container) return;
      }
      this.ensureMeta();
      var notifications = N.state.meta.notifications || [];
      var sessionEmail = (N.state.session && N.state.session.user && N.state.session.user.email || '').toLowerCase();
      var visible = notifications.filter(function(item) {
        return !item.read && item.recipient_email === sessionEmail;
      });
      if (!visible.length) {
        container.classList.remove('has-items');
        container.innerHTML = '';
        return;
      }
      container.classList.add('has-items');
      container.innerHTML = visible.map(function(item) {
        var zonesLabel = item.zones && item.zones.length ? item.zones.join(', ') : 'Todas';
        return (
          '<div class="zone-alert-card">' +
            '<div class="zone-alert-label">' + N.utils.escapeHtml(zonesLabel) + '</div>' +
            '<div class="zone-alert-message">' + N.utils.escapeHtml(item.message) + '</div>' +
            '<div class="zone-alert-actions">' +
              '<button class="btn btn-sm btn-outline" data-notification-id="' + item.id + '">Marcar leído</button>' +
            '</div>' +
          '</div>'
        );
      }).join('');
      container.querySelectorAll('[data-notification-id]').forEach(function(button) {
        button.addEventListener('click', function() {
          N.notifications.markRead(button.getAttribute('data-notification-id'));
        });
      });
    },
    markRead: function(id) {
      if (!id) return;
      this.ensureMeta();
      var notifications = N.state.meta.notifications || [];
      var updated = false;
      notifications.forEach(function(item) {
        if (item.id === id) {
          item.read = true;
          updated = true;
        }
      });
      if (updated) {
        N.data.saveState({ silent: true });
        this.render();
      }
    }
  };

  N.data = {
    _realtimeChannel: null,
    _pollIntervalId: null,
    _focusBound: false,
    _lastRefreshAt: 0,

    withTimeout: function(promise, ms, label) {
      var timerId = null;
      var timeout = new Promise(function(resolve) {
        timerId = setTimeout(function() {
          var err = new Error(label || 'timeout');
          err.code = 'timeout';
          resolve({ ok: false, error: err });
        }, ms);
      });

      var wrapped = Promise.resolve(promise).then(function(value) {
        clearTimeout(timerId);
        return { ok: true, value: value };
      }).catch(function(err) {
        clearTimeout(timerId);
        return { ok: false, error: err };
      });

      return Promise.race([wrapped, timeout]).then(function(result) {
        if (result.ok) return result.value;
        throw result.error;
      });
    },

    handleLoadFailure: function(message, silent) {
      var shouldToast = !N.state.isReady;
      N.state.isLoading = false;
      if (N.ui && N.ui.setGlobalLoading) {
        N.ui.setGlobalLoading(false);
      }
      if (shouldToast) {
        N.data.applyState({
          companies: Array.isArray(N.state.companies) ? N.state.companies : [],
          users: Array.isArray(N.state.users) ? N.state.users : [],
          meta: N.state.meta || {}
        });
        if (!silent && message && N.ui && N.ui.showToast && N.config.DEBUG_LOGS) {
          N.ui.showToast(message, 'error');
        }
      }
    },

    loadCache: function() {
      if (!N.config.CACHE_ENABLED) return null;
      try {
        var raw = sessionStorage.getItem(N.config.CACHE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || !parsed.state || !parsed.timestamp) return null;
        if (Date.now() - parsed.timestamp > N.config.CACHE_TTL_MS) return null;
        return parsed.state;
      } catch (_err) {
        return null;
      }
    },

    saveCache: function() {
      if (!N.config.CACHE_ENABLED) return;
      try {
        var payload = {
          timestamp: Date.now(),
          state: {
            companies: N.state.companies,
            users: N.state.users,
            meta: N.state.meta
          }
        };
        sessionStorage.setItem(N.config.CACHE_KEY, JSON.stringify(payload));
      } catch (_err) {
        // Ignore cache errors.
      }
    },

    clearCache: function() {
      if (!N.config.CACHE_ENABLED) return;
      try {
        sessionStorage.removeItem(N.config.CACHE_KEY);
      } catch (_err) {
        // Ignore cache errors.
      }
    },

    getAccessToken: async function() {
      var session = N.state.session;
      if (!session && window.supabaseClient) {
        var response = await window.supabaseClient.auth.getSession();
        session = response && response.data ? response.data.session : null;
      }
      return session ? session.access_token : null;
    },

    applyState: function(nextState) {
      function isUuid(value) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      }

      function normalizeCompany(company) {
        if (!company || typeof company !== 'object') return company;
        var normalized = Object.assign({}, company);
        if (!normalized.activity_code && normalized.actividad_economica) {
          normalized.activity_code = normalized.actividad_economica;
        }
        if (!normalized.phone && normalized.telefono) {
          normalized.phone = normalized.telefono;
        }
        if (!normalized.city && normalized.ciudad) {
          normalized.city = normalized.ciudad;
        }
        if (!normalized.address && normalized.direccion) {
          normalized.address = normalized.direccion;
        }
        delete normalized.actividad_economica;
        delete normalized.telefono;
        delete normalized.ciudad;
        delete normalized.direccion;
        if (!normalized.updated_at && normalized.created_at) {
          normalized.updated_at = normalized.created_at;
        }
        return normalized;
      }

      function buildFullName(meta) {
        var parts = [
          meta.first_name,
          meta.middle_name,
          meta.last_name,
          meta.mother_last_name
        ].filter(Boolean);
        return parts.join(' ');
      }

      function normalizeUser(user) {
        if (!user || typeof user !== 'object') return user;
        var normalized = Object.assign({}, user);
        var meta = Object.assign({}, normalized.user_metadata || {});
        var zones = N.utils.normalizeZones(meta.zones || meta.zone || meta.zona || []);
        if (zones.length) {
          meta.zones = zones;
        } else if (meta.zones) {
          meta.zones = [];
        }
        if (Array.isArray(meta.roles) && meta.roles.length) {
          meta.roles = meta.roles.map(function(role) {
            return String(role || '').trim().toLowerCase();
          }).filter(Boolean);
        }
        if (!Array.isArray(meta.roles) && meta.role) {
          meta.roles = [String(meta.role).trim().toLowerCase()];
        }
        if (!meta.role && Array.isArray(meta.roles) && meta.roles.length) {
          meta.role = meta.roles[0];
        }
        if (!meta.user_type) {
          meta.user_type = Array.isArray(meta.roles) && meta.roles.indexOf('cliente') >= 0 ? 'cliente' : 'staff';
        }
        if (!meta.full_name) {
          meta.full_name = buildFullName(meta);
        }
        normalized.user_metadata = meta;
        if (!normalized.auth_id && normalized.id && isUuid(normalized.id)) {
          normalized.auth_id = normalized.id;
        }
        if (!normalized.updated_at && normalized.created_at) {
          normalized.updated_at = normalized.created_at;
        }
        return normalized;
      }

      N.state.companies = (Array.isArray(nextState.companies) ? nextState.companies : []).map(normalizeCompany);
      N.state.users = (Array.isArray(nextState.users) ? nextState.users : []).map(normalizeUser);
      var meta = nextState.meta || {};
      N.state.meta = Object.assign({}, meta);
      N.state.meta.supportTemplates = Array.isArray(meta.supportTemplates) ? meta.supportTemplates : [];
      N.state.meta.productLibrary = Array.isArray(meta.productLibrary) ? meta.productLibrary : [];
      N.state.meta.productTemplates = Array.isArray(meta.productTemplates) ? meta.productTemplates : [];
      N.state.meta.auditLog = Array.isArray(meta.auditLog) ? meta.auditLog : [];
        N.state.meta.userRequests = Array.isArray(meta.userRequests) ? meta.userRequests : [];
        N.state.meta.companyRequests = Array.isArray(meta.companyRequests) ? meta.companyRequests : [];
        N.state.meta.notifications = Array.isArray(meta.notifications) ? meta.notifications : [];
      N.state.lastSyncAt = N.utils.nowISO();
      N.state.isReady = true;
      N.data.saveCache();
      document.dispatchEvent(new CustomEvent('state:updated'));
    },

    loadRemoteState: async function(options) {
      options = options || {};
      var silent = !!options.silent;
      if (!N.config.REMOTE_ENABLED || N.state.isLoading) return;
      if (!window.supabaseClient) return;

      N.state.isLoading = true;
      var loadingTimer = null;
      if (!silent && N.ui && N.ui.setGlobalLoading) {
        var grace = N.config.LOADING_GRACE_MS || 0;
        if (grace > 0) {
          loadingTimer = setTimeout(function() {
            N.ui.setGlobalLoading(true, 'Cargando estado...');
          }, grace);
        } else {
          N.ui.setGlobalLoading(true, 'Cargando estado...');
        }
      }

      function clearLoadingTimer() {
        if (loadingTimer) {
          clearTimeout(loadingTimer);
          loadingTimer = null;
        }
      }

      function finishLoading() {
        N.state.isLoading = false;
        clearLoadingTimer();
        if (!silent && N.ui && N.ui.setGlobalLoading) {
          N.ui.setGlobalLoading(false);
        }
      }

      var timeoutMs = N.config.REQUEST_TIMEOUT_MS || 10000;
      var edgeTimeout = N.config.EDGE_TIMEOUT_MS || timeoutMs;
      var tableTimeout = N.config.TABLE_TIMEOUT_MS || timeoutMs;

      var nextState = null;
      var useEdge = !!N.config.USE_EDGE_STATE;

      function readFromTable() {
        return N.data.withTimeout(
          window.supabaseClient
            .from(N.config.STATE_TABLE)
            .select('id, type, companies, users, meta')
            .in('id', [N.config.STATE_ROW_ID, '__meta__']),
          tableTimeout,
          'state_table_timeout'
        ).then(function(tableResponse) {
          if (tableResponse.error) throw tableResponse.error;

          var rows = tableResponse.data || [];
          var mainRow = rows.find(function(row) { return row.id === N.config.STATE_ROW_ID; });
          var metaRow = rows.find(function(row) { return row.id === '__meta__' && row.type === 'meta'; });

          return {
            companies: mainRow ? (mainRow.companies || []) : [],
            users: mainRow ? (mainRow.users || []) : [],
            meta: metaRow ? metaRow.meta : {}
          };
        });
      }

      async function readFromEdge() {
        var accessToken = await N.data.getAccessToken();
        if (!accessToken) throw new Error('missing_token');
        var edgeResponse = await N.data.withTimeout(
          window.supabaseClient.functions.invoke('admin-state', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + accessToken
            }
          }),
          edgeTimeout,
          'edge_state_timeout'
        );
        if (edgeResponse.error) throw edgeResponse.error;
        return edgeResponse.data || null;
      }

      if (N.config.PREFER_TABLE_READ) {
        try {
          nextState = await readFromTable();
        } catch (err) {
          if (N.config.DEBUG_LOGS) {
            console.warn('Failed to load state from table:', err ? err.message : err);
          }
        }

        if (!nextState && useEdge) {
          try {
            nextState = await readFromEdge();
          } catch (err) {
            if (N.config.DEBUG_LOGS) {
              console.warn('Edge state failed, falling back to table:', err ? err.message : err);
            }
          }
        }
      } else if (useEdge) {
        try {
          nextState = await readFromEdge();
        } catch (err) {
          if (N.config.DEBUG_LOGS) {
            console.warn('Edge state failed, falling back to table:', err ? err.message : err);
          }
        }

        if (!nextState) {
          try {
            nextState = await readFromTable();
          } catch (err) {
            if (N.config.DEBUG_LOGS) {
              console.warn('Failed to load state from table:', err ? err.message : err);
            }
          }
        }
      } else {
        try {
          nextState = await readFromTable();
        } catch (err) {
          if (N.config.DEBUG_LOGS) {
            console.warn('Failed to load state from table:', err ? err.message : err);
          }
        }
      }

      if (!nextState) {
        clearLoadingTimer();
        N.data.handleLoadFailure('No fue posible cargar el estado. Revisa admin-state o la tabla aexfy_admin_state.', silent);
        return;
      }

      N.data.applyState(nextState);
      finishLoading();
    },

    saveState: async function(options) {
      options = options || {};
      var silent = !!options.silent;
      if (!N.config.REMOTE_ENABLED || N.state.isSaving) return;
      if (!window.supabaseClient) return;

      N.state.isSaving = true;
      if (!silent && N.ui && N.ui.setGlobalLoading) {
        N.ui.setGlobalLoading(true, 'Guardando cambios...');
      }

      var accessToken = await N.data.getAccessToken();
      if (!accessToken) {
        N.state.isSaving = false;
        if (!silent && N.ui && N.ui.setGlobalLoading) {
          N.ui.setGlobalLoading(false);
        }
        return;
      }

      var payload = {
        companies: N.state.companies,
        users: N.state.users,
        meta: N.state.meta
      };

      var saved = false;

      if (N.config.USE_EDGE_STATE) {
        try {
          var edgeSave = await window.supabaseClient.functions.invoke('admin-state', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + accessToken
            },
            body: payload
          });
          if (edgeSave.error) throw edgeSave.error;
          saved = true;
        } catch (err) {
          if (N.config.DEBUG_LOGS) {
            console.warn('Edge save failed, falling back to table:', err ? err.message : err);
          }
        }
      }

      if (!saved) {
        try {
          var upsertMain = await window.supabaseClient
            .from(N.config.STATE_TABLE)
            .upsert({
              id: N.config.STATE_ROW_ID,
              companies: payload.companies,
              users: payload.users,
              updated_at: N.utils.nowISO()
            });
          if (upsertMain.error) throw upsertMain.error;

          var upsertMeta = await window.supabaseClient
            .from(N.config.STATE_TABLE)
            .upsert({
              id: '__meta__',
              type: 'meta',
              meta: payload.meta,
              updated_at: N.utils.nowISO()
            });
          if (upsertMeta.error) throw upsertMeta.error;

          saved = true;
        } catch (err) {
          if (N.config.DEBUG_LOGS) {
            console.warn('Failed to save state to table:', err ? err.message : err);
          }
        }
      }

      N.state.isSaving = false;
      if (!silent && N.ui && N.ui.setGlobalLoading) {
        N.ui.setGlobalLoading(false);
      }

      if (saved) {
        N.data.saveCache();
      }
      if (saved && N.auth && typeof N.auth.syncSessionWithState === 'function') {
        N.auth.syncSessionWithState('save');
      }
      if (saved) {
        document.dispatchEvent(new CustomEvent('state:updated'));
      }
      if (saved && !silent && N.ui && N.ui.showToast) {
        N.ui.showToast('Cambios guardados', 'success');
      }
    },

    bootstrapState: async function(options) {
      options = options || {};
      var cached = N.data.loadCache();
      var usedCache = false;
      if (cached) {
        N.data.applyState(cached);
        usedCache = true;
      }
      if (options.cacheOnly) return null;
      var canRemote = !!(N.config.REMOTE_ENABLED && window.supabaseClient);
      var loadPromise = null;
      if (canRemote) {
        var silentLoad = usedCache || options.silent || options.background;
        loadPromise = N.data.loadRemoteState({ silent: silentLoad });
        if (!options.background) {
          await loadPromise;
        }
      }
      if (!N.state.isReady) {
        N.data.applyState({
          companies: Array.isArray(N.state.companies) ? N.state.companies : [],
          users: Array.isArray(N.state.users) ? N.state.users : [],
          meta: N.state.meta || {}
        });
      }
      if (canRemote) {
        if (N.config.REALTIME_ENABLED) {
          N.data.setupRealtime();
        } else {
          N.data.setupPolling();
        }
        N.data.setupFocusRefresh();
      }
      return loadPromise;
    },

    setupRealtime: function() {
      if (!window.supabaseClient || N.data._realtimeChannel) return;

      var reload = N.utils.debounce(function() {
        N.data.loadRemoteState();
      }, 1500);

      N.data._realtimeChannel = window.supabaseClient
        .channel('aexfy-admin-state')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: N.config.STATE_TABLE,
          filter: 'id=eq.' + N.config.STATE_ROW_ID
        }, function() {
          reload();
        })
        .subscribe(function(status) {
          if (status === 'SUBSCRIBED') {
            if (N.data._pollIntervalId) {
              clearInterval(N.data._pollIntervalId);
              N.data._pollIntervalId = null;
            }
            if (N.config.POLL_WHEN_REALTIME) {
              N.data.setupPolling();
            }
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            N.data.setupPolling();
          }
        });
    },

    setupPolling: function() {
      if (N.data._pollIntervalId) return;
      N.data._pollIntervalId = setInterval(function() {
        N.data.loadRemoteState();
      }, N.config.POLL_INTERVAL_MS);
    },

    setupFocusRefresh: function() {
      if (N.data._focusBound) return;
      N.data._focusBound = true;

      function refreshOnFocus() {
        var now = Date.now();
        var minGap = N.config.FOCUS_REFRESH_MS || 0;
        if (now - N.data._lastRefreshAt < minGap) return;
        N.data._lastRefreshAt = now;
        N.data.loadRemoteState({ silent: true });
      }

      window.addEventListener('focus', refreshOnFocus);
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
          refreshOnFocus();
        }
      });
    }
  };
})();
