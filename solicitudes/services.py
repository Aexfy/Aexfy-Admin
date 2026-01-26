from integraciones.supabase_client import get_supabase_service_client


# Normaliza la data de una RPC para trabajar siempre con listas o dict.
def _normalizar_data(respuesta):
    return getattr(respuesta, "data", None)


# Lista solicitudes con filtros de estado y tipo.
def listar_solicitudes_admin(filtros: dict):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "listar_solicitudes_admin",
        {
            "p_estado": filtros.get("estado"),
            "p_tipo": filtros.get("tipo"),
            "p_limit": filtros.get("limit", 100),
            "p_offset": filtros.get("offset", 0),
        },
    ).execute()
    return _normalizar_data(respuesta) or []


# Obtiene una solicitud especifica por id.
def obtener_solicitud_admin(request_id: str):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "obtener_solicitud_admin",
        {
            "p_request_id": request_id,
        },
    ).execute()
    data = _normalizar_data(respuesta)
    if isinstance(data, list):
        return data[0] if data else None
    return data


# Actualiza el estado de una solicitud (aprobado/rechazado).
def actualizar_solicitud_admin(request_id: str, status: str, reviewer_id: str, decision_note: str | None):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "actualizar_solicitud_admin",
        {
            "p_request_id": request_id,
            "p_status": status,
            "p_reviewer_id": reviewer_id,
            "p_decision_note": decision_note,
        },
    ).execute()
    data = _normalizar_data(respuesta)
    if not data:
        raise ValueError("No se pudo actualizar la solicitud.")
    return data


# Crea una solicitud generica (staff, empresa u otras).
def crear_solicitud_admin(datos: dict):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "crear_solicitud_admin",
        {
            "p_request_type": datos.get("request_type"),
            "p_status": datos.get("status"),
            "p_metadata": datos.get("metadata") or {},
            "p_submitted_by": datos.get("submitted_by"),
        },
    ).execute()
    data = _normalizar_data(respuesta)
    if not data:
        raise ValueError("No se pudo crear la solicitud.")
    return data
