import logging

from django.conf import settings
from django.shortcuts import redirect, render

from cuentas.decorators import sesion_requerida
from cuentas.forms import LoginForm
from cuentas.services import iniciar_sesion_supabase, obtener_usuario_por_rut
from cuentas.sesiones import guardar_sesion, limpiar_sesion, obtener_usuario_sesion

# Logger para registrar errores de autenticacion sin exponer detalles al usuario.
logger = logging.getLogger(__name__)


# Vista de login; valida RUT y usa Supabase Auth para iniciar sesion.
def login_view(request):
    # Si ya hay sesion, se envia al inicio para no repetir login.
    if request.session.get("supabase_access_token"):
        return redirect("inicio")

    if request.method == "POST":
        # Formulario con reglas de formateo del RUT.
        form = LoginForm(request.POST)
        if form.is_valid():
            rut = form.cleaned_data["rut"]
            password = form.cleaned_data["password"]

            # Busca el usuario en la tabla aexfy.usuarios usando el RUT formateado.
            usuario = obtener_usuario_por_rut(rut)
            if not usuario:
                form.add_error("rut", "No existe un usuario con ese RUT.")
            elif usuario.get("estado") != "activo":
                form.add_error(None, "El usuario no esta activo.")
            else:
                try:
                    # Usa el email de aexfy.usuarios para autenticar en Supabase Auth.
                    auth_respuesta = iniciar_sesion_supabase(usuario.get("email"), password)
                    if not getattr(auth_respuesta, "session", None):
                        form.add_error("password", "Credenciales invalidas.")
                    else:
                        # Guarda tokens y datos del usuario en la sesion de Django.
                        guardar_sesion(request, auth_respuesta, usuario)
                        return redirect("inicio")
                except Exception as exc:
                    # Registra el error real en el log para depuracion interna.
                    logger.warning("Error Supabase Auth al iniciar sesion: %s", exc)
                    # Muestra mensaje generico al usuario final.
                    form.add_error(None, "No se pudo iniciar sesion. Revisa tus datos.")
    else:
        # Formulario vacio para GET.
        form = LoginForm()

    # Renderiza el template de login ubicado en cuentas/templates/cuentas/login.html.
    return render(request, "cuentas/login.html", {"form": form})


# Vista de inicio protegida; muestra info basica de la sesion.
@sesion_requerida
def inicio_view(request):
    # Recupera datos de usuario guardados en la sesion en cuentas/sesiones.py.
    usuario = obtener_usuario_sesion(request)
    return render(request, "cuentas/inicio.html", {"usuario": usuario})


# Cierra sesion local y redirige al login.
def logout_view(request):
    # Limpia la sesion local; los tokens se eliminan del navegador.
    limpiar_sesion(request)
    return redirect("login")


# Vista publica para que usuarios invitados creen su contrasena desde el link de Supabase.
def activar_password_view(request):
    # Entrega credenciales publicas para que el JS actualice la contrasena via Supabase Auth.
    return render(
        request,
        "cuentas/activar_password.html",
        {
            "supabase_url": settings.SUPABASE_URL,
            "supabase_anon_key": settings.SUPABASE_ANON_KEY,
        },
    )
