from django.http import HttpRequest

from cuentas.services import registrar_sesion_usuario_admin

# Guarda datos de la sesion en Django; se usa en views.py y en templates.
def guardar_sesion(request: HttpRequest, auth_response, usuario: dict) -> None:
    # Guarda tokens de Supabase para operaciones futuras en backend.
    request.session["supabase_access_token"] = getattr(auth_response.session, "access_token", "")
    request.session["supabase_refresh_token"] = getattr(auth_response.session, "refresh_token", "")

    # Guarda datos basicos del usuario para mostrar en la UI.
    request.session["usuario"] = {
        "id": usuario.get("id"),
        "auth_id": usuario.get("auth_id"),
        "email": usuario.get("email"),
        "rut": usuario.get("rut"),
        "nombres": usuario.get("nombres"),
        "apellidos": usuario.get("apellidos"),
        "estado": usuario.get("estado"),
        "zona": usuario.get("zona"),
    }

    # Asegura que exista session_key para validacion de sesion unica.
    if not request.session.session_key:
        request.session.save()

    usuario_id = usuario.get("id")
    if usuario_id and request.session.session_key:
        try:
            registrar_sesion_usuario_admin(
                str(usuario_id),
                request.session.session_key,
                request.META.get("REMOTE_ADDR"),
                request.META.get("HTTP_USER_AGENT"),
            )
        except Exception:
            # Evita bloquear el login si falla el registro remoto.
            pass



# Limpia la sesion local; se usa en logout para cerrar la sesion en Django.
def limpiar_sesion(request: HttpRequest, limpiar_remota: bool = True) -> None:
    # Limpia la session_key registrada para invalidar otras sesiones.
    if limpiar_remota:
        usuario = request.session.get("usuario") or {}
        usuario_id = usuario.get("id")
        if usuario_id:
            try:
                registrar_sesion_usuario_admin(str(usuario_id), None, None, None)
            except Exception:
                # Evita bloquear el logout si falla el registro remoto.
                pass
    # Flush elimina toda la sesion, incluyendo tokens y datos del usuario.
    request.session.flush()


# Obtiene el usuario de sesion para mostrar en la vista de inicio.
def obtener_usuario_sesion(request: HttpRequest) -> dict | None:
    # Retorna el diccionario guardado o None si no existe.
    return request.session.get("usuario")
