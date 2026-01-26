from django.apps import AppConfig


# Configuracion de la app de empresas; se registra en settings.py.
class EmpresasConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "empresas"
