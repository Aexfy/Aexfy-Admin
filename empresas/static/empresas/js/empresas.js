// Logica de seleccion masiva y valores segun accion en listado de empresas.
// Usa el modal global definido en aexfy_admin/static/aexfy_admin/js/base.js.
(() => {
  const selectorTodos = document.getElementById("seleccionar_todos");
  const checkboxes = document.querySelectorAll("input[name='empresas_seleccionadas']");
  const accion = document.getElementById("accion_masiva");
  const valorEstado = document.getElementById("valor_estado");
  const valorPlan = document.getElementById("valor_plan");
  const valorZona = document.getElementById("valor_zona");
  const valorHidden = document.getElementById("valor_masivo");
  const formMasivo = document.getElementById("form_masivo");

  if (selectorTodos) {
    selectorTodos.addEventListener("change", () => {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = selectorTodos.checked;
      });
    });
  }

  const ocultarValores = () => {
    if (valorEstado) valorEstado.style.display = "none";
    if (valorPlan) valorPlan.style.display = "none";
    if (valorZona) valorZona.style.display = "none";
  };

  const actualizarValor = () => {
    if (!accion || !valorHidden) return;
    if (accion.value === "estado" && valorEstado) {
      valorHidden.value = valorEstado.querySelector("select").value;
    } else if (accion.value === "plan" && valorPlan) {
      valorHidden.value = valorPlan.querySelector("select").value;
    } else if (accion.value === "zona" && valorZona) {
      valorHidden.value = valorZona.querySelector("select").value;
    } else {
      valorHidden.value = "";
    }
  };

  if (accion) {
    accion.addEventListener("change", () => {
      ocultarValores();
      if (accion.value === "estado" && valorEstado) valorEstado.style.display = "inline";
      if (accion.value === "plan" && valorPlan) valorPlan.style.display = "inline";
      if (accion.value === "zona" && valorZona) valorZona.style.display = "inline";
      actualizarValor();
    });
  }

  [valorEstado, valorPlan, valorZona].forEach((contenedor) => {
    if (!contenedor) return;
    const select = contenedor.querySelector("select");
    if (select) {
      select.addEventListener("change", actualizarValor);
    }
  });

  ocultarValores();

  // Confirmacion antes de aplicar cambios masivos usando el modal global.
  if (formMasivo) {
    formMasivo.addEventListener("submit", (event) => {
      if (!accion || !valorHidden) return;
      const seleccionados = document.querySelectorAll("input[name='empresas_seleccionadas']:checked");
      if (!accion.value || !valorHidden.value || seleccionados.length === 0) {
        return;
      }
      const mensaje = `Aplicar '${accion.value}' a ${seleccionados.length} empresa(s). ¿Confirmas?`;
      if (window.AexfyConfirm) {
        event.preventDefault();
        window.AexfyConfirm(mensaje, () => {
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
