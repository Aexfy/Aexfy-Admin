import re
from pathlib import Path
from django.conf import settings
from supabase_auth.errors import AuthApiError

from integraciones.supabase_client import get_supabase_service_client

# Cache simple de roles parseados desde roles.txt.
_roles_cache = None


# Extrae un mensaje legible desde AuthApiError (o excepcion similar).
def extraer_mensaje_auth(exc: Exception) -> str:
    mensaje = ""
    if hasattr(exc, "message") and getattr(exc, "message"):
        mensaje = str(getattr(exc, "message"))
    elif getattr(exc, "args", None):
        primer = exc.args[0]
        if isinstance(primer, dict):
            mensaje = str(primer.get("message") or primer.get("msg") or "")
        else:
            mensaje = str(primer)
    if not mensaje:
        mensaje = str(exc)
    return mensaje.strip()


def es_error_email_invalido(exc: Exception) -> bool:
    mensaje = extraer_mensaje_auth(exc).lower()
    return ("invalid" in mensaje and "email" in mensaje) or "correo" in mensaje


# Genera un enlace de invitacion o recuperacion para crear contrasena.
def generar_link_invitacion(email: str, metadata: dict):
    email = (email or "").strip().lower()
    if not email:
        raise ValueError("Correo invalido.")
    cliente = get_supabase_service_client()
    opciones = {}
    if getattr(settings, "SUPABASE_INVITE_REDIRECT_URL", ""):
        opciones["redirect_to"] = settings.SUPABASE_INVITE_REDIRECT_URL

    for tipo in ("invite", "recovery"):
        try:
            respuesta = cliente.auth.admin.generate_link(
                {
                    "type": tipo,
                    "email": email,
                    "options": {
                        "redirect_to": opciones.get("redirect_to"),
                        "data": metadata,
                    },
                }
            )
            usuario = getattr(respuesta, "user", None) or respuesta.user
            # Sincroniza metadatos en Auth para mantener rol/rut.
            if usuario:
                cliente.auth.admin.update_user_by_id(
                    usuario.id,
                    {
                        "user_metadata": metadata,
                    },
                )
            enlace = getattr(getattr(respuesta, "properties", None), "action_link", None)
            return usuario, enlace
        except AuthApiError as exc:
            mensaje = extraer_mensaje_auth(exc).lower()
            ya_registrado = "already" in mensaje and ("exist" in mensaje or "registered" in mensaje)
            if tipo == "invite" and ya_registrado:
                continue
            raise

# Obtiene roles disponibles desde roles.txt (lineas con ':' que representan roles).
def obtener_roles_disponibles(include_owner: bool = False):
    global _roles_cache
    if _roles_cache is not None:
        if include_owner and ("AexfyOwner", "AexfyOwner") not in _roles_cache:
            return [("AexfyOwner", "AexfyOwner")] + _roles_cache
        return _roles_cache

    ruta = Path("roles.txt")
    if not ruta.exists():
        # Fallback si el archivo no existe; permite operar sin bloqueo.
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

    # Evita lista vacia si el archivo tiene otro formato.
    _roles_cache = roles_unicos or [("AexfyOwner", "AexfyOwner")]
    if include_owner and ("AexfyOwner", "AexfyOwner") not in _roles_cache:
        return [("AexfyOwner", "AexfyOwner")] + _roles_cache
    return _roles_cache


def _normalizar_respuesta_rpc(respuesta):
    # Normaliza la respuesta de RPC para devolver siempre un diccionario o None.
    data = getattr(respuesta, "data", None)
    if isinstance(data, list):
        return data[0] if data else None
    return data


# Verifica si existe un usuario en Auth por email.
def existe_usuario_auth_por_email(email: str) -> bool:
    cliente = get_supabase_service_client()
    usuarios = cliente.auth.admin.list_users()
    if isinstance(usuarios, list):
        lista = usuarios
    else:
        lista = getattr(usuarios, "users", [])

    for usuario in lista:
        if getattr(usuario, "email", None) == email:
            return True

    return False


# Valida unicidad de rut, email y telefono antes de crear un usuario.
def validar_unicidad(rut: str, email: str, telefono: str):
    # Usa una RPC en esquema publico para validar sin exponer el esquema aexfy.
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "validar_unicidad_staff",
        {"p_rut": rut, "p_email": email, "p_telefono": telefono},
    ).execute()
    data = _normalizar_respuesta_rpc(respuesta) or {}
    if not isinstance(data, dict):
        return {}
    return data


# Invita al usuario en Supabase Auth para que cree su contrasena por correo.
def invitar_usuario_auth(email: str, metadata: dict):
    email = (email or "").strip().lower()
    if not email:
        raise ValueError("Correo invalido.")
    cliente = get_supabase_service_client()
    # Envia invitacion por email para que el usuario defina su contrasena.
    opciones = {}
    # Usa un redirect configurable para llevar a la pagina de creacion de contrasena.
    if getattr(settings, "SUPABASE_INVITE_REDIRECT_URL", ""):
        opciones["redirect_to"] = settings.SUPABASE_INVITE_REDIRECT_URL

    try:
        respuesta = cliente.auth.admin.invite_user_by_email(email, opciones or None)
        usuario = getattr(respuesta, "user", None) or respuesta
        # Actualiza metadatos del usuario invitado.
        cliente.auth.admin.update_user_by_id(
            usuario.id,
            {
                "user_metadata": metadata,
            },
        )
        return usuario, None
    except AuthApiError as exc:
        # Fallback: si hay limite de correos, genera link manual para compartirlo.
        if "rate limit" in str(exc).lower():
            respuesta = cliente.auth.admin.generate_link(
                {
                    "type": "invite",
                    "email": email,
                    "options": {
                        "redirect_to": opciones.get("redirect_to"),
                        "data": metadata,
                    },
                }
            )
            usuario = getattr(respuesta, "user", None) or respuesta.user
            enlace = getattr(respuesta, "properties", None)
            return usuario, getattr(enlace, "action_link", None)
        raise


# Inserta el usuario en aexfy.usuarios y devuelve el registro creado.
def crear_usuario_aexfy(datos: dict):
    # Inserta el usuario usando RPC en esquema publico para evitar exponer aexfy.
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc("crear_usuario_staff", datos).execute()
    data = _normalizar_respuesta_rpc(respuesta)
    if not data:
        raise ValueError("No se pudo insertar el usuario en aexfy.usuarios.")
    return data
