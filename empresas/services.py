from integraciones.supabase_client import get_supabase_service_client


# Normaliza data retornada por RPC para evitar None.
def _normalizar_data(respuesta):
    return getattr(respuesta, "data", None)


# Lista empresas con filtros desde el backend.
def listar_empresas_admin(filtros: dict):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "listar_empresas_admin",
        {
            "p_busqueda": filtros.get("busqueda"),
            "p_estado": filtros.get("estado"),
            "p_plan": filtros.get("plan"),
            "p_zona": filtros.get("zona"),
            "p_limit": filtros.get("limit", 100),
            "p_offset": filtros.get("offset", 0),
        },
    ).execute()
    return _normalizar_data(respuesta) or []


# Obtiene una empresa especifica por id.
def obtener_empresa_admin(empresa_id: str):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "obtener_empresa_admin",
        {
            "p_empresa_id": empresa_id,
        },
    ).execute()
    data = _normalizar_data(respuesta)
    if isinstance(data, list):
        return data[0] if data else None
    return data


# Crea una empresa usando la RPC publica.
def crear_empresa_admin(datos: dict):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc("crear_empresa_admin", datos).execute()
    data = _normalizar_data(respuesta)
    if not data:
        raise ValueError("No se pudo crear la empresa.")
    return data


# Actualiza una empresa usando la RPC publica.
def actualizar_empresa_admin(datos: dict):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc("actualizar_empresa_admin", datos).execute()
    data = _normalizar_data(respuesta)
    if not data:
        raise ValueError("No se pudo actualizar la empresa.")
    return data


# Cambios masivos sobre empresas (estado, plan o zona).
def cambios_masivos_empresas(empresa_ids: list[str], accion: str, valor: str):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "cambios_masivos_empresas",
        {
            "p_empresa_ids": empresa_ids,
            "p_accion": accion,
            "p_valor": valor,
        },
    ).execute()
    return _normalizar_data(respuesta)


# Elimina una empresa y sus datos asociados (usuarios cliente y auth).
def eliminar_empresa_admin(empresa_id: str):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "eliminar_empresa_admin",
        {
            "p_empresa_id": empresa_id,
        },
    ).execute()
    data = _normalizar_data(respuesta)
    if not data:
        raise ValueError("No se pudo eliminar la empresa.")
    return data


# Lista segmentos industriales para poblar selects en el formulario.
def listar_segmentos_admin():
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "listar_segmentos_admin",
        {},
    ).execute()
    return _normalizar_data(respuesta) or []


# Lista regiones de Chile para poblar selects en el formulario.
def listar_regiones_admin():
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "listar_regiones_admin",
        {},
    ).execute()
    return _normalizar_data(respuesta) or []


# Obtiene roles del usuario actual para validar autorizacion.
def obtener_roles_usuario_admin(usuario_id: str):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "obtener_roles_usuario_admin",
        {
            "p_usuario_id": usuario_id,
        },
    ).execute()
    data = _normalizar_data(respuesta)
    if isinstance(data, list) and data:
        return data[0].get("roles") or []
    if isinstance(data, dict):
        return data.get("roles") or []
    return []


# Crea una solicitud de empresa cuando se requiere autorizacion.
def crear_solicitud_empresa_admin(datos: dict):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc("crear_solicitud_empresa_admin", datos).execute()
    data = _normalizar_data(respuesta)
    if not data:
        raise ValueError("No se pudo crear la solicitud de empresa.")
    return data


# Crea empresa y usuario duenio en una sola operacion.
def crear_empresa_con_owner_admin(datos: dict):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "crear_empresa_con_owner_admin",
        datos,
    ).execute()
    data = _normalizar_data(respuesta)
    if not data:
        raise ValueError("No se pudo crear la empresa con duenio.")
    return data
