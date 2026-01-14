// js/support.js

(function(N) {
  'use strict';

  if (!N) return;

  var support = N.support = {};
  var VIEW_ID = 'soporte';
  var ui = {};

  function canManage() {
    var level = N.state.session && N.state.session.accessLevel;
    return level === 'owner' || level === 'manager' || level === 'support';
  }

  function getTemplates() {
    N.state.meta.supportTemplates = N.state.meta.supportTemplates || [];
    return N.state.meta.supportTemplates;
  }

  function getProducts() {
    N.state.meta.productLibrary = N.state.meta.productLibrary || [];
    return N.state.meta.productLibrary;
  }

  function openTemplateModal(item) {
    var isEditing = !!item;
    var template = N.utils.$('#support-template-form-template');
    if (!template) return;

    var fragment = template.content.cloneNode(true);
    var form = fragment.querySelector('#support-template-form');
    if (!form) return;

    if (isEditing) {
      form.querySelector('[name="id"]').value = item.id || '';
      form.querySelector('[name="title"]').value = item.title || '';
      form.querySelector('[name="category"]').value = item.category || '';
      form.querySelector('[name="body"]').value = item.body || '';
      form.querySelector('[name="status"]').value = item.status || 'active';
    }

    var footer =
      '<div class="btn-group">' +
        '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
        '<button type="submit" form="support-template-form" class="btn btn-primary">Guardar</button>' +
      '</div>';

    var overlay = N.ui.showModal(isEditing ? 'Editar template' : 'Nuevo template', form.outerHTML, footer);
    if (!overlay) return;

    var modalForm = N.utils.$('#support-template-form');
    if (modalForm) modalForm.addEventListener('submit', handleTemplateSubmit);

    var closeBtn = N.utils.$('[data-modal-close]', overlay);
    if (closeBtn) closeBtn.addEventListener('click', function() { N.ui.closeModal(); });
  }

  async function handleTemplateSubmit(event) {
    event.preventDefault();
    var form = event.target;
    if (form.checkValidity && !form.checkValidity()) {
      form.reportValidity();
      return;
    }
    var unlock = N.utils.lockForm(form);
    if (!unlock) return;
    try {
      var data = Object.fromEntries(new FormData(form).entries());

      if (data.id) {
        var index = getTemplates().findIndex(function(item) { return item.id === data.id; });
        if (index >= 0) {
          getTemplates()[index] = Object.assign({}, getTemplates()[index], data, { updated_at: N.utils.nowISO() });
          N.audit.log('support_template_update', { id: data.id, title: data.title });
        }
      } else {
        var newItem = Object.assign({}, data, {
          id: N.utils.uid('tpl'),
          status: data.status || 'active',
          created_at: N.utils.nowISO()
        });
        getTemplates().push(newItem);
        N.audit.log('support_template_create', { id: newItem.id, title: newItem.title });
      }

      await N.data.saveState();
      N.ui.closeModal();
      renderTemplates();
    } finally {
      unlock();
    }
  }

  function openProductModal(item) {
    var isEditing = !!item;
    var template = N.utils.$('#product-form-template');
    if (!template) return;

    var fragment = template.content.cloneNode(true);
    var form = fragment.querySelector('#product-form');
    if (!form) return;

    if (isEditing) {
      form.querySelector('[name="id"]').value = item.id || '';
      form.querySelector('[name="name"]').value = item.name || '';
      form.querySelector('[name="sku"]').value = item.sku || '';
      form.querySelector('[name="price"]').value = item.price || '';
      form.querySelector('[name="status"]').value = item.status || 'active';
    }

    var footer =
      '<div class="btn-group">' +
        '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
        '<button type="submit" form="product-form" class="btn btn-primary">Guardar</button>' +
      '</div>';

    var overlay = N.ui.showModal(isEditing ? 'Editar producto' : 'Nuevo producto', form.outerHTML, footer);
    if (!overlay) return;

    var modalForm = N.utils.$('#product-form');
    if (modalForm) modalForm.addEventListener('submit', handleProductSubmit);

    var closeBtn = N.utils.$('[data-modal-close]', overlay);
    if (closeBtn) closeBtn.addEventListener('click', function() { N.ui.closeModal(); });
  }

  async function handleProductSubmit(event) {
    event.preventDefault();
    var form = event.target;
    if (form.checkValidity && !form.checkValidity()) {
      form.reportValidity();
      return;
    }
    var unlock = N.utils.lockForm(form);
    if (!unlock) return;
    try {
      var data = Object.fromEntries(new FormData(form).entries());

      if (data.id) {
        var index = getProducts().findIndex(function(item) { return item.id === data.id; });
        if (index >= 0) {
          getProducts()[index] = Object.assign({}, getProducts()[index], data, { updated_at: N.utils.nowISO() });
          N.audit.log('product_update', { id: data.id, name: data.name });
        }
      } else {
        var newItem = Object.assign({}, data, {
          id: N.utils.uid('prd'),
          status: data.status || 'active',
          created_at: N.utils.nowISO()
        });
        getProducts().push(newItem);
        N.audit.log('product_create', { id: newItem.id, name: newItem.name });
      }

      await N.data.saveState();
      N.ui.closeModal();
      renderProducts();
    } finally {
      unlock();
    }
  }

  async function handleDeleteTemplate(id) {
    if (!window.confirm('Eliminar este template?')) return;
    N.state.meta.supportTemplates = getTemplates().filter(function(item) { return item.id !== id; });
    N.audit.log('support_template_delete', { id: id });
    await N.data.saveState();
    renderTemplates();
  }

  async function handleDeleteProduct(id) {
    if (!window.confirm('Eliminar este producto?')) return;
    N.state.meta.productLibrary = getProducts().filter(function(item) { return item.id !== id; });
    N.audit.log('product_delete', { id: id });
    await N.data.saveState();
    renderProducts();
  }

  function renderTemplates() {
    if (!ui.templatesList) return;
    var list = getTemplates();

    var columns = [
      { key: 'title', label: 'Titulo' },
      { key: 'category', label: 'Categoria' },
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

    N.ui.renderTable('#support-templates-list', columns, list, {
      emptyState: {
        title: 'Sin templates',
        message: 'Agrega templates de soporte para el equipo.'
      }
    });
  }

  function renderProducts() {
    if (!ui.productsList) return;
    var list = getProducts();

    var columns = [
      { key: 'name', label: 'Producto' },
      { key: 'sku', label: 'SKU' },
      { key: 'price', label: 'Precio' },
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

    N.ui.renderTable('#product-library-list', columns, list, {
      emptyState: {
        title: 'Sin productos',
        message: 'Agrega productos para uso interno.'
      }
    });
  }

  support.init = function() {
    ui = {
      container: N.utils.$('#soporte-content'),
      templatesList: N.utils.$('#support-templates-list'),
      productsList: N.utils.$('#product-library-list'),
      templateBtn: N.utils.$('#support-template-btn'),
      productBtn: N.utils.$('#product-library-btn')
    };

    if (!ui.container) return;

    if (ui.templateBtn) {
      ui.templateBtn.style.display = canManage() ? '' : 'none';
      if (canManage()) {
        ui.templateBtn.addEventListener('click', function() { openTemplateModal(null); });
      }
    }

    if (ui.productBtn) {
      ui.productBtn.style.display = canManage() ? '' : 'none';
      if (canManage()) {
        ui.productBtn.addEventListener('click', function() { openProductModal(null); });
      }
    }

    if (ui.templatesList) {
      ui.templatesList.addEventListener('click', function(event) {
        var button = event.target.closest('button[data-action]');
        if (!button) return;
        if (!canManage()) return;
        var action = button.getAttribute('data-action');
        var id = button.getAttribute('data-id');
        var item = getTemplates().find(function(row) { return row.id === id; });

        if (action === 'edit' && item) openTemplateModal(item);
        if (action === 'delete') handleDeleteTemplate(id);
      });
    }

    if (ui.productsList) {
      ui.productsList.addEventListener('click', function(event) {
        var button = event.target.closest('button[data-action]');
        if (!button) return;
        if (!canManage()) return;
        var action = button.getAttribute('data-action');
        var id = button.getAttribute('data-id');
        var item = getProducts().find(function(row) { return row.id === id; });

        if (action === 'edit' && item) openProductModal(item);
        if (action === 'delete') handleDeleteProduct(id);
      });
    }

    document.addEventListener('state:updated', function() {
      render();
    });
  };

  function render() {
    if (!ui.container) return;
    N.ui.setViewTitle('Soporte');
    N.ui.setActiveNav(VIEW_ID);
    renderTemplates();
    renderProducts();
  }

  support.render = render;
})(window.Aexfy);

