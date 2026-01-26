from __future__ import annotations

# Roles que deben limitar su operacion a la zona asignada.
ROLES_RESTRINGIDOS_ZONA = {"Supervisor", "Vendedor", "Capacitador", "Instalador"}
ROLES_SIN_RESTRICCION_ZONA = {"AexfyOwner", "Gerente"}


# Determina si el usuario debe operar solo en su zona.
def requiere_restriccion_zona(roles: list[str]) -> bool:
    if not roles:
        return False
    # Si tiene un rol superior, no aplica restriccion de zona.
    if set(roles).intersection(ROLES_SIN_RESTRICCION_ZONA):
        return False
    return bool(set(roles).intersection(ROLES_RESTRINGIDOS_ZONA))


# Extrae la zona actual desde la sesion.
def obtener_zona_sesion(session) -> str | None:
    usuario = session.get("usuario") or {}
    return usuario.get("zona")


# Aplica una zona fija en un formulario si existe el campo.
def aplicar_zona_formulario(form, zona: str | None) -> None:
    if not form or not zona:
        return
    if "zona" in getattr(form, "fields", {}):
        # Limita el selector a una sola opcion para evitar que se muestren otras zonas.
        # Esto aplica cuando el rol requiere operar en una unica zona.
        form.fields["zona"].choices = [(zona, zona)]
        form.fields["zona"].initial = zona
        form.fields["zona"].disabled = True
