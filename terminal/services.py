from integraciones.supabase_client import get_supabase_service_client


# Ejecuta SQL usando la RPC segura en Supabase e incluye actor para auditoria.
def ejecutar_sql_admin(sql: str, actor_id: str | None, actor_email: str | None):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "ejecutar_sql_admin",
        {
            "p_sql": sql,
            "p_actor_id": actor_id,
            "p_actor_email": actor_email,
        },
    ).execute()
    data = getattr(respuesta, "data", None)
    if not data:
        raise ValueError("No se pudo ejecutar el script.")
    return data
