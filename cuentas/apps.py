from django.apps import AppConfig

# Configuracion del app cuentas; se registra en settings.py y expone templates del app.
class CuentasConfig(AppConfig):
    # default_auto_field aplica a modelos futuros si se crean.
    default_auto_field = "django.db.models.BigAutoField"
    # name se usa en INSTALLED_APPS y urls.py del proyecto.
    name = "cuentas"
