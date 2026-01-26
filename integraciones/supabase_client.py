from django.conf import settings
from supabase import Client, create_client

# Valida que existan credenciales en settings.py; evita fallas silenciosas.
def _validar_credenciales():
    # SUPABASE_URL y SUPABASE_ANON_KEY vienen de settings.py y .env.
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise ValueError(
            "Faltan SUPABASE_URL o SUPABASE_ANON_KEY en settings.py/.env para crear el cliente."
        )


# Crea un cliente anonimo para operaciones seguras desde Django.
def get_supabase_client() -> Client:
    # Verifica credenciales antes de crear el cliente que se usa en servicios o vistas.
    _validar_credenciales()
    # create_client crea el cliente HTTP que consumira la API de Supabase.
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


# Crea un cliente con rol de servicio para tareas administrativas controladas.
def get_supabase_service_client() -> Client:
    # Usa SUPABASE_SERVICE_KEY si existe; se define junto con SUPABASE_URL en settings.py.
    if not settings.SUPABASE_SERVICE_KEY:
        raise ValueError(
            "Falta SUPABASE_SERVICE_KEY en settings.py/.env para crear el cliente de servicio."
        )
    # create_client se reutiliza con la llave de servicio para operaciones privilegiadas.
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
