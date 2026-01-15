// js/ui.js
// Shared UI helpers.

(function(N) {
  'use strict';

  if (!N) return;

  var ui = N.ui = {};

  ui.setLoading = function(containerSelector, show) {
    var container = N.utils.$(containerSelector);
    if (container) {
      container.classList.toggle('is-loading', !!show);
    }
  };

  ui.setGlobalLoading = function(show, message) {
    var overlay = N.utils.$('#global-loading');
    if (!overlay) return;
    if (N.config && N.config.SHOW_LOADING === false) {
      overlay.classList.remove('is-visible');
      return;
    }
    overlay.classList.toggle('is-visible', !!show);
    var label = N.utils.$('#global-loading-text');
    if (label && message) {
      label.textContent = message;
    }
  };

  ui.setViewTitle = function(title) {
    var el = N.utils.$('#view-title');
    if (el) el.textContent = title;
  };

  ui.setActiveNav = function(viewName) {
    N.utils.$$('.sidebar-nav .nav-link').forEach(function(link) {
      link.classList.toggle('active', link.dataset.view === viewName);
    });
  };

  ui.showToast = function(message, type, duration) {
    var toastRoot = N.utils.$('#toast-root');
    if (!toastRoot) {
      toastRoot = document.createElement('div');
      toastRoot.id = 'toast-root';
      document.body.appendChild(toastRoot);
    }

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    toast.textContent = message;

    toastRoot.appendChild(toast);

    setTimeout(function() {
      toast.classList.add('is-visible');
    }, 10);

    setTimeout(function() {
      toast.classList.remove('is-visible');
      toast.addEventListener('transitionend', function() {
        toast.remove();
      });
    }, duration || 3000);
  };

  ui.renderEmptyState = function(containerSelector, options) {
    var container = N.utils.$(containerSelector);
    if (!container) return;

    var title = options && options.title ? options.title : 'Sin datos';
    var message = options && options.message ? options.message : 'No hay informacion disponible.';

    container.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-title">' + N.utils.escapeHtml(title) + '</div>' +
        '<div class="empty-message">' + N.utils.escapeHtml(message) + '</div>' +
      '</div>';
  };

  ui.renderTable = function(containerSelector, columns, data, options) {
    var container = N.utils.$(containerSelector);
    if (!container) return;

    if (!data || !data.length) {
      ui.renderEmptyState(containerSelector, options && options.emptyState ? options.emptyState : null);
      return;
    }

    var thead = '<thead><tr>' + columns.map(function(col) {
      return '<th>' + N.utils.escapeHtml(col.label || '') + '</th>';
    }).join('') + '</tr></thead>';

    var tbody = '<tbody>' + data.map(function(row) {
      var cells = columns.map(function(col) {
        var rawValue = col.key.split('.').reduce(function(acc, key) {
          return acc && acc[key] !== undefined ? acc[key] : '';
        }, row);
        var htmlValue = col.formatter ? col.formatter(rawValue, row) : N.utils.escapeHtml(N.utils.safeText(rawValue, '-'));
        return '<td>' + htmlValue + '</td>';
      }).join('');
      return '<tr>' + cells + '</tr>';
    }).join('') + '</tbody>';

    container.innerHTML = '<table class="data-table">' + thead + tbody + '</table>';
  };

  ui.showModal = function(title, bodyContent, footerContent) {
    var existing = N.utils.$('.modal-overlay');
    if (existing) existing.remove();

    var markup =
      '<div class="modal-overlay">' +
        '<div class="modal">' +
          '<div class="modal-header">' +
            '<h3>' + N.utils.escapeHtml(title) + '</h3>' +
            '<button class="modal-close" aria-label="Cerrar">x</button>' +
          '</div>' +
          '<div class="modal-body">' + bodyContent + '</div>' +
          (footerContent ? '<div class="modal-footer">' + footerContent + '</div>' : '') +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', markup);

    var overlay = N.utils.$('.modal-overlay');
    var closeBtn = N.utils.$('.modal-close', overlay);

    function closeModal() {
      overlay.classList.remove('is-visible');
      overlay.addEventListener('transitionend', function() {
        overlay.remove();
      }, { once: true });
    }

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    setTimeout(function() {
      overlay.classList.add('is-visible');
    }, 10);

    return overlay;
  };

  ui.closeModal = function() {
    var overlay = N.utils.$('.modal-overlay');
    if (overlay) {
      var closeBtn = N.utils.$('.modal-close', overlay);
      if (closeBtn) closeBtn.click();
    }
  };

  ui.init = function() {
    // Placeholder for global UI bindings.
  };
})(window.Aexfy);

