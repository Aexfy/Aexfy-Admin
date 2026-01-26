// Maneja la creacion de contrasena desde el link de invitacion de Supabase.
(() => {
  const form = document.getElementById("activar-form");
  const mensaje = document.getElementById("activar-mensaje");
  if (!form || !mensaje) {
    return;
  }

  // Lee credenciales publicas que vienen desde cuentas/views.py.
  const supabaseUrl = form.dataset.supabaseUrl || "";
  const supabaseAnon = form.dataset.supabaseAnon || "";

  // Extrae access_token desde el hash (#access_token=...).
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : "";
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const tipo = params.get("type");
  const rutEl = document.getElementById("activar-usuario-rut");
  const nombreEl = document.getElementById("activar-usuario-nombre");
  const emailEl = document.getElementById("activar-usuario-email");

  // Valida que el link sea de invitacion o recuperacion.
  if (!accessToken || !tipo) {
    mensaje.textContent =
      "El enlace no contiene un token valido. Revisa el correo o solicita una nueva invitacion.";
    return;
  }

  if (!["invite", "recovery"].includes(tipo)) {
    mensaje.textContent =
      "Tipo de enlace no valido. Usa el link de invitacion enviado por correo.";
    return;
  }

  // Oculta el hash para no dejar el token visible en la barra.
  history.replaceState(null, "", window.location.pathname);

  const cargarDatosUsuario = async () => {
    if (!rutEl || !nombreEl || !emailEl) {
      return;
    }
    try {
      const respuesta = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: supabaseAnon,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!respuesta.ok) {
        return;
      }

      const data = await respuesta.json().catch(() => ({}));
      const usuario = data.user || data;
      const metadata = (usuario && usuario.user_metadata) || {};
      const nombre = metadata.full_name || metadata.fullName || "--";

      rutEl.textContent = metadata.rut || "--";
      nombreEl.textContent = nombre || "--";
      emailEl.textContent = usuario.email || "--";
    } catch (error) {
      // Silencioso: el formulario sigue funcionando aunque no carguen los datos.
    }
  };

  cargarDatosUsuario();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = form.querySelector("#password").value.trim();
    const confirm = form.querySelector("#password_confirm").value.trim();

    if (!password || password.length < 8) {
      mensaje.textContent = "La contrasena debe tener al menos 8 caracteres.";
      return;
    }
    if (password !== confirm) {
      mensaje.textContent = "Las contrasenas no coinciden.";
      return;
    }

    mensaje.textContent = "Guardando contrasena...";

    try {
      const respuesta = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnon,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password }),
      });

      if (!respuesta.ok) {
        const error = await respuesta.json().catch(() => ({}));
        mensaje.textContent =
          error.error_description ||
          error.msg ||
          "No se pudo actualizar la contrasena. Intenta nuevamente.";
        return;
      }

      mensaje.textContent =
        "Contrasena creada correctamente. Ya puedes iniciar sesion.";
      form.reset();
    } catch (error) {
      mensaje.textContent =
        "No se pudo contactar a Supabase. Revisa tu conexion.";
    }
  });
})();
