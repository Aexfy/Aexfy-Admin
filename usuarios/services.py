from integraciones.supabase_client import get_supabase_service_client


# Normaliza la respuesta de RPC para devolver lista o dict.
def _normalizar_data(respuesta):
    data = getattr(respuesta, "data", None)
    return data


# Lista usuarios aplicando filtros y paginacion basica.
def listar_usuarios_admin(filtros: dict):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "listar_usuarios_admin",
        {
            "p_busqueda": filtros.get("busqueda"),
            "p_estado": filtros.get("estado"),
            "p_tipo": filtros.get("tipo_usuario"),
            "p_zona": filtros.get("zona"),
            "p_rol": filtros.get("rol"),
            "p_limit": filtros.get("limit", 100),
            "p_offset": filtros.get("offset", 0),
        },
    ).execute()
    data = _normalizar_data(respuesta)
    return data or []


# Obtiene un usuario especifico para editarlo.
def obtener_usuario_admin(usuario_id: str):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "obtener_usuario_admin",
        {
            "p_usuario_id": usuario_id,
        },
    ).execute()
    data = _normalizar_data(respuesta)
    if isinstance(data, list):
        return data[0] if data else None
    return data


# Actualiza un usuario existente con validaciones en el servidor.
def actualizar_usuario_admin(datos: dict):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc("actualizar_usuario_admin", datos).execute()
    data = _normalizar_data(respuesta)
    if not data:
        raise ValueError("No se pudo actualizar el usuario.")
    return data


# Guarda el enlace de invitacion generado para el usuario.
def actualizar_invite_usuario_admin(usuario_id: str, invite_link: str):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "actualizar_invite_usuario_admin",
        {"p_usuario_id": usuario_id, "p_invite_link": invite_link},
    ).execute()
    data = _normalizar_data(respuesta)
    if not data:
        raise ValueError("No se pudo actualizar el enlace de invitacion.")
    return data


# Ejecuta cambios masivos sobre un conjunto de usuarios.
def cambios_masivos_usuarios(usuario_ids: list[str], accion: str, valor: str):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "cambios_masivos_usuarios",
        {
            "p_usuario_ids": usuario_ids,
            "p_accion": accion,
            "p_valor": valor,
        },
    ).execute()
    return _normalizar_data(respuesta)


# Elimina un usuario del sistema (auth + aexfy.usuarios).
def eliminar_usuario_admin(usuario_id: str):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "eliminar_usuario_admin_text",
        {
            "p_usuario_id": str(usuario_id),
        },
    ).execute()
    data = _normalizar_data(respuesta)
    if not data:
        raise ValueError("No se pudo eliminar el usuario.")
    return data
