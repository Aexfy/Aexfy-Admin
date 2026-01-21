// js/analytics.js

(function(N) {
  'use strict';

  if (!N) return;

  var analytics = N.analytics = {};
  var VIEW_ID = 'analitica';
  var ui = {};

  function countBy(list, key) {
    return list.reduce(function(acc, item) {
      var value = item[key] || 'sin_dato';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  function getVisibleCompanies() {
    return N.utils.filterCompaniesByAccess(N.state.companies || []);
  }

  function getVisibleUsers() {
    return N.utils.filterUsersByAccess(N.state.users || []);
  }

  function renderKPIs() {
    if (!ui.kpis) return;

    var companies = getVisibleCompanies();
    var users = getVisibleUsers();
    var activeCompanies = companies.filter(function(c) { return c.status === 'active'; }).length;
    var pendingCompanies = companies.filter(function(c) { return c.status === 'pending'; }).length;
    var blockedCompanies = companies.filter(function(c) { return c.status === 'blocked'; }).length;
    var activeUsers = users.filter(function(u) { return u.status !== 'disabled'; }).length;

    var cards = [
      { label: 'Empresas', value: companies.length },
      { label: 'Empresas activas', value: activeCompanies },
      { label: 'Empresas pendientes', value: pendingCompanies },
      { label: 'Empresas bloqueadas', value: blockedCompanies },
      { label: 'Usuarios', value: users.length },
      { label: 'Usuarios activos', value: activeUsers }
    ];

    ui.kpis.innerHTML = cards.map(function(card) {
      return '<div class="kpi-card">' +
        '<div class="kpi-value">' + N.utils.escapeHtml(card.value) + '</div>' +
        '<div class="kpi-label">' + N.utils.escapeHtml(card.label) + '</div>' +
      '</div>';
    }).join('');
  }

  function renderPlanBreakdown() {
    if (!ui.plans) return;
    var planCounts = countBy(getVisibleCompanies(), 'plan');
    var entries = Object.keys(planCounts);

    if (!entries.length) {
      ui.plans.innerHTML = '<div class="empty-note">Sin datos de planes.</div>';
      return;
    }

    ui.plans.innerHTML = entries.map(function(plan) {
      return '<div class="metric-row">' +
        '<span>' + N.utils.escapeHtml(plan) + '</span>' +
        '<span>' + N.utils.escapeHtml(planCounts[plan]) + '</span>' +
      '</div>';
    }).join('');
  }

  function renderStatusBreakdown() {
    if (!ui.status) return;
    var statusCounts = countBy(getVisibleCompanies(), 'status');
    var entries = Object.keys(statusCounts);

    if (!entries.length) {
      ui.status.innerHTML = '<div class="empty-note">Sin datos de estados.</div>';
      return;
    }

    ui.status.innerHTML = entries.map(function(status) {
      return '<div class="metric-row">' +
        '<span>' + N.utils.escapeHtml(N.utils.getStatusLabel(status)) + '</span>' +
        '<span>' + N.utils.escapeHtml(statusCounts[status]) + '</span>' +
      '</div>';
    }).join('');
  }

  function render() {
    if (!ui.container) return;
    N.ui.setViewTitle('Analitica');
    N.ui.setActiveNav(VIEW_ID);
    renderKPIs();
    renderPlanBreakdown();
    renderStatusBreakdown();
  }

  analytics.init = function() {
    ui = {
      container: N.utils.$('#analitica-content'),
      kpis: N.utils.$('#analytics-kpis'),
      plans: N.utils.$('#analytics-plans'),
      status: N.utils.$('#analytics-status')
    };

    if (!ui.container) return;

    document.addEventListener('state:updated', function() {
      render();
    });
  };

  analytics.render = render;
})(window.Aexfy);

