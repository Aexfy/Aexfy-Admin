import os

from django.core.wsgi import get_wsgi_application

# Configuracion WSGI para despliegue; usa settings.py y es llamado por servidores WSGI.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aexfy_admin.settings")

# Crea la aplicacion WSGI que comparte configuracion con manage.py.
application = get_wsgi_application()
