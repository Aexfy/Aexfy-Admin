from django.apps import AppConfig


# Configuracion de la app de usuarios; se registra en settings.py.
class UsuariosConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "usuarios"
