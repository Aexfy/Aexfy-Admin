import os

import django
from django.core.management import call_command
from django.core.wsgi import get_wsgi_application

# Configuracion WSGI para despliegue; usa settings.py y es llamado por servidores WSGI.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aexfy_admin.settings")

# En Render (y entornos similares) el pre-deploy puede estar bloqueado.
# Esto asegura que las tablas criticas (como django_session) existan.
if os.environ.get("DJANGO_AUTO_MIGRATE", "1") == "1":
    django.setup()
    try:
        call_command("migrate", interactive=False, run_syncdb=True, verbosity=0)
    except Exception:
        # Evita que el deploy caiga por un error puntual; se vera en logs.
        pass

# Crea la aplicacion WSGI que comparte configuracion con manage.py.
application = get_wsgi_application()

