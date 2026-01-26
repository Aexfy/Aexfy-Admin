from integraciones.supabase_client import (
    get_supabase_client,
    get_supabase_service_client,
)


def _normalizar_data(respuesta):
    data = getattr(respuesta, "data", None)
    return data


# Consulta el usuario en la vista publica de login; se usa desde cuentas/views.py.
def obtener_usuario_por_rut(rut: str) -> dict | None:
    # Usa el cliente anonimo para consultar la vista publica en schema public.
    cliente = get_supabase_client()
    respuesta = (
        cliente.schema("public")
        .table("v_usuarios_login")
        .select("id, auth_id, email, rut, estado, nombres, apellidos, zona")
        .eq("rut", rut)
        .limit(1)
        .execute()
    )

    # Si no hay resultados, retorna None para que la vista muestre el error.
    if not respuesta.data:
        return None

    return respuesta.data[0]


# Inicia sesion en Supabase Auth con email y password; se usa desde cuentas/views.py.
def iniciar_sesion_supabase(email: str, password: str):
    # Usa el cliente anonimo para autenticar al usuario final.
    cliente = get_supabase_client()
    return cliente.auth.sign_in_with_password({"email": email, "password": password})


# Registra la session_key activa para forzar sesion unica.
def registrar_sesion_usuario_admin(
    usuario_id: str, session_key: str | None, ip: str | None, user_agent: str | None
):
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "registrar_sesion_usuario_admin",
        {
            "p_usuario_id": usuario_id,
            "p_session_key": session_key,
            "p_ip": ip,
            "p_user_agent": user_agent,
        },
    ).execute()
    return _normalizar_data(respuesta)


# Obtiene la session_key registrada para validar sesion unica.
def obtener_sesion_usuario_admin(usuario_id: str) -> dict | None:
    cliente = get_supabase_service_client()
    respuesta = cliente.rpc(
        "obtener_sesion_usuario_admin",
        {"p_usuario_id": usuario_id},
    ).execute()
    data = _normalizar_data(respuesta)
    if isinstance(data, list):
        return data[0] if data else None
    return data
