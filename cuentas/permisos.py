from __future__ import annotations

# Roles base segun roles.txt.
ROLE_ADMIN = {"AexfyOwner", "Gerente"}
ROLE_RRHH = {"Jefe RRHH", "RRHH"}
ROLE_SOPORTE = {"Jefe de soporte", "Soporte"}
ROLE_SUPERVISION = {"Supervisor"}
ROLE_COMERCIAL = {"Vendedor", "Capacitador"}
ROLE_INSTALACION = {"Instalador"}

# Matriz de permisos por modulo.
PERMISOS = {
    "staff": ROLE_ADMIN | ROLE_RRHH | ROLE_SUPERVISION,
    "usuarios": ROLE_ADMIN | ROLE_RRHH | ROLE_SUPERVISION,
    "empresas": ROLE_ADMIN | ROLE_SUPERVISION | ROLE_COMERCIAL,
    "solicitudes": ROLE_ADMIN | ROLE_RRHH | ROLE_SUPERVISION,
    "auditoria": ROLE_ADMIN | ROLE_SOPORTE,
    "reportes": ROLE_ADMIN,
    "terminal": ROLE_ADMIN,
}

# Etiquetas legibles para UI.
PERMISO_LABELS = {
    "staff": "Crear staff",
    "usuarios": "Gestión de usuarios",
    "empresas": "Gestión de empresas",
    "solicitudes": "Solicitudes",
    "auditoria": "Auditoría",
    "reportes": "Reportes",
    "terminal": "Terminal SQL",
}


# Determina si el usuario tiene permiso segun sus roles.
def tiene_permiso(roles: list[str], clave_permiso: str) -> bool:
    if not roles:
        return False
    # Si tiene rol admin, siempre permite.
    if ROLE_ADMIN.intersection(roles):
        return True
    permitidos = PERMISOS.get(clave_permiso, set())
    return bool(set(roles).intersection(permitidos))


# Devuelve descripcion legible del permiso.
def descripcion_permiso(clave_permiso: str) -> str:
    return PERMISO_LABELS.get(clave_permiso, clave_permiso)


# Determina si un rol puede asignar un rol de staff especifico.
def puede_asignar_rol_staff(roles: list[str], rol_objetivo: str) -> bool:
    if rol_objetivo == "AexfyOwner":
        return bool("AexfyOwner" in roles)
    # AexfyOwner puede asignar cualquier rol de staff.
    if "AexfyOwner" in roles:
        return True
    # Gerente solo puede asignar Supervisor y roles operativos.
    if "Gerente" in roles:
        return rol_objetivo in {"Supervisor", "Instalador", "Vendedor", "Capacitador"}
    # RRHH puede asignar cualquier rol de staff (excepto AexfyOwner).
    if ROLE_RRHH.intersection(roles):
        return True
    # Otros roles admin (no Gerente) pueden asignar roles de staff.
    if ROLE_ADMIN.intersection(roles):
        return True
    # Supervisor solo puede crear roles operativos.
    if ROLE_SUPERVISION.intersection(roles):
        return rol_objetivo in {"Instalador", "Vendedor", "Capacitador"}
    return False


# Acciones masivas de usuarios: solo Admin o RRHH.
def puede_accion_masiva_usuarios(roles: list[str]) -> bool:
    return bool(ROLE_ADMIN.intersection(roles) or ROLE_RRHH.intersection(roles))


# Eliminacion de usuarios: Supervisor o superior (segun roles.txt).
def puede_eliminar_usuarios(roles: list[str]) -> bool:
    roles_habilitados = ROLE_ADMIN | {"Supervisor", "Jefe RRHH", "Jefe de soporte"}
    return bool(roles_habilitados.intersection(roles))


# Acciones masivas de empresas: solo Admin por seguridad.
def puede_accion_masiva_empresas(roles: list[str]) -> bool:
    return bool(ROLE_ADMIN.intersection(roles))


# Permite editar empresas segun rol.
def puede_editar_empresas(roles: list[str]) -> bool:
    return bool(ROLE_ADMIN.intersection(roles) or ROLE_SUPERVISION.intersection(roles))


# Eliminacion de empresas: mismo criterio que edicion (Admin o Supervisor).
def puede_eliminar_empresas(roles: list[str]) -> bool:
    return bool(ROLE_ADMIN.intersection(roles) or ROLE_SUPERVISION.intersection(roles))
