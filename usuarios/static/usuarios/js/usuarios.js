// Logica de seleccion masiva y valores segun accion en listado de usuarios.
// Usa el modal global definido en aexfy_admin/static/aexfy_admin/js/base.js.
(() => {
  const selectorTodos = document.getElementById("seleccionar_todos");
  const checkboxes = document.querySelectorAll("input[name='usuarios_seleccionados']");
  const accion = document.getElementById("accion_masiva");
  const valorEstado = document.getElementById("valor_estado");
  const valorZona = document.getElementById("valor_zona");
  const valorRol = document.getElementById("valor_rol");
  const valorHidden = document.getElementById("valor_masivo");
  const formMasivo = document.getElementById("form_masivo");
  let envioConfirmado = false;

  if (selectorTodos) {
    selectorTodos.addEventListener("change", () => {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = selectorTodos.checked;
      });
    });
  }

  const ocultarValores = () => {
    if (valorEstado) valorEstado.style.display = "none";
    if (valorZona) valorZona.style.display = "none";
    if (valorRol) valorRol.style.display = "none";
  };

  const actualizarValor = () => {
    if (!accion || !valorHidden) return;
    if (accion.value === "estado" && valorEstado) {
      valorHidden.value = valorEstado.querySelector("select").value;
    } else if (accion.value === "zona" && valorZona) {
      valorHidden.value = valorZona.querySelector("select").value;
    } else if (accion.value === "rol" && valorRol) {
      valorHidden.value = valorRol.querySelector("select").value;
    } else if (accion.value === "eliminar") {
      valorHidden.value = "1";
    } else {
      valorHidden.value = "";
    }
  };

  if (accion) {
    accion.addEventListener("change", () => {
      ocultarValores();
      if (accion.value === "estado" && valorEstado) valorEstado.style.display = "inline";
      if (accion.value === "zona" && valorZona) valorZona.style.display = "inline";
      if (accion.value === "rol" && valorRol) valorRol.style.display = "inline";
      actualizarValor();
    });
  }

  [valorEstado, valorZona, valorRol].forEach((contenedor) => {
    if (!contenedor) return;
    const select = contenedor.querySelector("select");
    if (select) {
      select.addEventListener("change", actualizarValor);
    }
  });

  // Estado inicial
  ocultarValores();

  // Confirmacion antes de aplicar cambios masivos usando el modal global.
  if (formMasivo) {
    formMasivo.addEventListener("submit", (event) => {
      if (!accion || !valorHidden) return;
      if (envioConfirmado) {
        envioConfirmado = false;
        return;
      }
      const seleccionados = document.querySelectorAll("input[name='usuarios_seleccionados']:checked");
      if (!accion.value || seleccionados.length === 0) {
        return;
      }
      if (accion.value !== "eliminar" && !valorHidden.value) {
        return;
      }
      const mensaje = `Aplicar '${accion.value}' a ${seleccionados.length} usuario(s). Confirmas?`;
      if (window.AexfyConfirm) {
        event.preventDefault();
        window.AexfyConfirm(mensaje, () => {
          envioConfirmado = true;
          if (typeof formMasivo.requestSubmit === "function") {
            formMasivo.requestSubmit();
          } else {
            formMasivo.submit();
          }
        });
      }
    });
  }
})();
