from integraciones.supabase_client import get_supabase_service_client


# Normaliza data retornada por RPC para evitar None.
def _normalizar_data(respuesta):
    data = getattr(respuesta, "data", None)
    if isinstance(data, list):
        return data[0] if data else {}
    return data or {}


# Obtiene resumen de empresas por zona/estado/plan.
def obtener_resumen_empresas():
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc("resumen_empresas_admin", {}).execute()
    return _normalizar_data(respuesta)


# Obtiene resumen de usuarios por zona/estado/tipo.
def obtener_resumen_usuarios():
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc("resumen_usuarios_admin", {}).execute()
    return _normalizar_data(respuesta)
