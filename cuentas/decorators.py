from functools import wraps

from django.shortcuts import redirect, render

from cuentas.permisos import descripcion_permiso, tiene_permiso
from cuentas.sesiones import limpiar_sesion
from cuentas.services import obtener_sesion_usuario_admin, registrar_sesion_usuario_admin
from empresas.services import obtener_roles_usuario_admin
from usuarios.services import obtener_usuario_admin

# Decorador para proteger vistas; verifica sesion de Supabase en Django.
def sesion_requerida(vista_func):
    # wraps mantiene metadatos de la vista original.
    @wraps(vista_func)
    def _envuelto(request, *args, **kwargs):
        # Si no hay token, envia al login definido en cuentas/urls.py.
        if not request.session.get("supabase_access_token"):
            return redirect("login")
        # Asegura que exista session_key para validar sesion unica.
        if not request.session.session_key:
            request.session.save()

        # Obtiene roles desde BD en cada request para evitar sesiones desactualizadas.
        # Usa empresas/services.py -> RPC obtener_roles_usuario_admin en DB_Aexfy.db.
        # Esto alimenta permisos (cuentas/permisos.py) y visibilidad (usuarios/views.py).
        usuario = request.session.get("usuario") or {}
        usuario_id = usuario.get("id")
        roles = obtener_roles_usuario_admin(usuario_id) if usuario_id else []
        request.session["roles"] = roles

        # Valida sesion unica contra la session_key registrada en BD.
        if usuario_id:
            try:
                sesion_db = obtener_sesion_usuario_admin(str(usuario_id)) or {}
                session_key_db = sesion_db.get("session_key") or ""
                if session_key_db and session_key_db != request.session.session_key:
                    limpiar_sesion(request, limpiar_remota=False)
                    return redirect("login")
                if not session_key_db and request.session.session_key:
                    registrar_sesion_usuario_admin(
                        str(usuario_id),
                        request.session.session_key,
                        request.META.get("REMOTE_ADDR"),
                        request.META.get("HTTP_USER_AGENT"),
                    )
            except Exception:
                # Si falla la validacion remota, no bloquea el acceso.
                pass

        # Si el rol es superior (Gerente/AexfyOwner), la zona no aplica y se limpia en sesion.
        # Se mantiene coherencia con cuentas/zonas.py para evitar filtros innecesarios.
        ignorar_zona = bool(roles and ({"Gerente", "AexfyOwner"} & set(roles)))
        if ignorar_zona:
            if "usuario" in request.session:
                request.session["usuario"]["zona"] = None
        # Refresca zona en sesion si aun no existe.
        # Refresca zona desde BD si la sesion viene de versiones anteriores sin este dato.
        if "usuario" in request.session and not request.session["usuario"].get("zona") and not ignorar_zona:
            usuario_id = (request.session.get("usuario") or {}).get("id")
            if usuario_id:
                usuario_db = obtener_usuario_admin(str(usuario_id))
                if usuario_db:
                    request.session["usuario"]["zona"] = usuario_db.get("zona")
        # Ejecuta la vista original si la sesion existe.
        return vista_func(request, *args, **kwargs)

    return _envuelto


# Decorador para proteger vistas segun roles.
def permiso_requerido(clave_permiso: str):
    def _decorador(vista_func):
        @wraps(vista_func)
        def _envuelto(request, *args, **kwargs):
            roles = request.session.get("roles") or []
            if not tiene_permiso(roles, clave_permiso):
                return render(
                    request,
                    "cuentas/sin_permisos.html",
                    {
                        "permiso": descripcion_permiso(clave_permiso),
                        "roles": roles,
                    },
                )
            return vista_func(request, *args, **kwargs)

        return _envuelto

    return _decorador
