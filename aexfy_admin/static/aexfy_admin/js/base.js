// Modal de confirmacion global; se usa desde templates con data-confirm.
(() => {
  const overlay = document.getElementById("confirm-overlay");
  const messageEl = document.getElementById("confirm-message");
  const btnCancel = document.getElementById("confirm-cancel");
  const btnAccept = document.getElementById("confirm-accept");

  if (!overlay || !messageEl || !btnCancel || !btnAccept) {
    return;
  }

  // Asegura estado inicial oculto para evitar que el modal aparezca en pantalla.
  overlay.hidden = true;

  // Abre el modal y ejecuta un callback al confirmar.
  const abrirConfirmacion = (mensaje, onConfirm) => {
    messageEl.textContent = mensaje;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    overlay.hidden = false;

    const cerrar = () => {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      overlay.hidden = true;
      btnAccept.onclick = null;
      btnCancel.onclick = null;
      overlay.onclick = null;
      document.removeEventListener("keydown", onKeydown);
    };

    const onKeydown = (event) => {
      if (event.key === "Escape") {
        cerrar();
      }
    };

    btnAccept.onclick = () => {
      cerrar();
      if (typeof onConfirm === "function") {
        onConfirm();
      }
    };

    btnCancel.onclick = cerrar;
    overlay.onclick = (event) => {
      if (event.target === overlay) {
        cerrar();
      }
    };

    document.addEventListener("keydown", onKeydown);
    btnAccept.focus();
  };

  // Expone la funcion para usarla en otros scripts.
  window.AexfyConfirm = abrirConfirmacion;

  // Asocia confirmaciones a elementos con data-confirm.
  document.querySelectorAll("[data-confirm]").forEach((elemento) => {
    elemento.addEventListener("click", (event) => {
      const mensaje = elemento.getAttribute("data-confirm") || "¿Deseas continuar?";
      event.preventDefault();

      abrirConfirmacion(mensaje, () => {
        if (elemento.tagName === "A") {
          window.location.href = elemento.getAttribute("href");
          return;
        }
        const form = elemento.form;
        if (form) {
          if (typeof form.requestSubmit === "function") {
            form.requestSubmit(elemento);
          } else {
            form.submit();
          }
        }
      });
    });
  });
})();
