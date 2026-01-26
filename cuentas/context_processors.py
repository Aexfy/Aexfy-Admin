from cuentas.permisos import (
    puede_accion_masiva_empresas,
    puede_accion_masiva_usuarios,
    puede_editar_empresas,
    puede_eliminar_usuarios,
    puede_eliminar_empresas,
    tiene_permiso,
)


# Expone permisos de navegacion a los templates base.
def permisos_nav(request):
    roles = request.session.get("roles") or []
    usuario = request.session.get("usuario") or {}
    return {
        "roles_usuario": roles,
        "perm_nav": {
            "staff": tiene_permiso(roles, "staff"),
            "usuarios": tiene_permiso(roles, "usuarios"),
            "empresas": tiene_permiso(roles, "empresas"),
            "solicitudes": tiene_permiso(roles, "solicitudes"),
            "auditoria": tiene_permiso(roles, "auditoria"),
            "reportes": tiene_permiso(roles, "reportes"),
            "terminal": tiene_permiso(roles, "terminal"),
        },
        # Permisos para acciones específicas dentro de los módulos.
        "perm_acciones": {
            "usuarios_masivo": puede_accion_masiva_usuarios(roles),
            "usuarios_eliminar": puede_eliminar_usuarios(roles),
            "empresas_masivo": puede_accion_masiva_empresas(roles),
            "empresas_editar": puede_editar_empresas(roles),
            "empresas_eliminar": puede_eliminar_empresas(roles),
        },
        "realtime_enabled": bool(request.session.get("supabase_access_token")),
    }
