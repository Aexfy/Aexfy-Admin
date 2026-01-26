#!/usr/bin/env python
import os
import sys

# Punto de entrada para comandos de Django; usa aexfy_admin/settings.py
# para cargar configuracion y coordina con wsgi.py/asgi.py en despliegue.

def main():
    # Define el modulo de settings que usan manage.py y el resto de archivos Django.
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aexfy_admin.settings")
    try:
        # Carga el ejecutor de comandos de Django que usa settings.py y apps instaladas.
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        # Mensaje claro si Django no esta instalado en el entorno de ejecucion.
        raise ImportError(
            "No se pudo importar Django. Verifica que este instalado y en el entorno activo."
        ) from exc
    # Ejecuta comandos de Django (runserver, migrate, etc.) usando settings.py.
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    # Ejecuta main cuando se corre el archivo directamente.
    main()
