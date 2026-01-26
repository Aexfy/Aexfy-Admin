from pathlib import Path

# Cache simple de roles para evitar leer roles.txt en cada request.
_roles_cache = None


# Lee roles.txt y devuelve una lista de tuplas (rol, rol) para choices.
def obtener_roles_disponibles(include_owner: bool = False):
    global _roles_cache
    if _roles_cache is not None:
        if include_owner and ("AexfyOwner", "AexfyOwner") not in _roles_cache:
            return [("AexfyOwner", "AexfyOwner")] + _roles_cache
        return _roles_cache

    ruta = Path("roles.txt")
    if not ruta.exists():
        _roles_cache = [("AexfyOwner", "AexfyOwner")]
        return _roles_cache

    roles = []
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#"):
            continue
        if ":" in linea:
            rol = linea.split(":", 1)[0].strip()
            # Excluye encabezados que no son roles reales.
            if rol.lower() in {"credenciales", "crea a", "contraseña", "aexfyowner"}:
                continue
            if rol:
                roles.append((rol, rol))

    # Elimina duplicados manteniendo orden.
    vistos = set()
    roles_unicos = []
    for rol in roles:
        if rol[0] not in vistos:
            roles_unicos.append(rol)
            vistos.add(rol[0])

    _roles_cache = roles_unicos or [("AexfyOwner", "AexfyOwner")]
    if include_owner and ("AexfyOwner", "AexfyOwner") not in _roles_cache:
        return [("AexfyOwner", "AexfyOwner")] + _roles_cache
    return _roles_cache
