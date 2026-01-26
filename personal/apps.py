from django.apps import AppConfig

# Configuracion del app personal; se registra en settings.py para habilitar templates y rutas.
class PersonalConfig(AppConfig):
    # default_auto_field aplica a modelos futuros si se agregan.
    default_auto_field = "django.db.models.BigAutoField"
    # name se usa en INSTALLED_APPS y urls.py del proyecto.
    name = "personal"
