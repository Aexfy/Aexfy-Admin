from django.apps import AppConfig

# Configuracion del app integraciones; se registra en settings.py.
class IntegracionesConfig(AppConfig):
    # default_auto_field aplica a modelos futuros del app.
    default_auto_field = "django.db.models.BigAutoField"
    # name es el identificador usado en INSTALLED_APPS.
    name = "integraciones"
