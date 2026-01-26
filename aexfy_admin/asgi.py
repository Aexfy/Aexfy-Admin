import os

from django.core.asgi import get_asgi_application

# Configuracion ASGI para despliegue async; usa settings.py y es llamada por servidores ASGI.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aexfy_admin.settings")

# Crea la aplicacion ASGI que comparte configuracion con manage.py.
application = get_asgi_application()
