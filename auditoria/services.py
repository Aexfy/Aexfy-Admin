from integraciones.supabase_client import get_supabase_service_client


# Normaliza la data de una RPC para evitar None.
def _normalizar_data(respuesta):
    return getattr(respuesta, "data", None)


# Registra un evento de auditoria en la base de datos.
def registrar_evento_auditoria(actor: dict, accion: str, tabla: str | None, id_objetivo: str | None, severidad: str = "media", metadatos: dict | None = None):
    if not actor:
        return None

    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "registrar_evento_auditoria",
        {
            "p_actor_id": actor.get("id"),
            "p_actor_email": actor.get("email"),
            "p_accion": accion,
            "p_tabla_objetivo": tabla,
            "p_id_objetivo": id_objetivo,
            "p_severidad": severidad,
            "p_metadatos": metadatos or {},
        },
    ).execute()
    return _normalizar_data(respuesta)


# Lista eventos de auditoria para el modulo admin.
def listar_auditoria_admin(filtros: dict):
    cliente = get_supabase_service_client()
    fecha_desde = filtros.get("fecha_desde")
    fecha_hasta = filtros.get("fecha_hasta")
    if hasattr(fecha_desde, "isoformat"):
        fecha_desde = fecha_desde.isoformat()
    if hasattr(fecha_hasta, "isoformat"):
        fecha_hasta = fecha_hasta.isoformat()
    respuesta = cliente.rpc(
        "listar_auditoria_admin",
        {
            "p_busqueda": filtros.get("busqueda"),
            "p_severidad": filtros.get("severidad"),
            "p_fecha_desde": fecha_desde,
            "p_fecha_hasta": fecha_hasta,
            "p_limit": filtros.get("limit", 100),
            "p_offset": filtros.get("offset", 0),
        },
    ).execute()
    return _normalizar_data(respuesta) or []


# Obtiene un evento de auditoria por id para ver detalles.
def obtener_auditoria_admin(evento_id: str):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "obtener_auditoria_admin",
        {"p_evento_id": evento_id},
    ).execute()
    data = _normalizar_data(respuesta)
    if isinstance(data, list):
        return data[0] if data else None
    return data
