from django.contrib import admin
from django.urls import include, path

from aexfy_admin.realtime import realtime_stream_view

# Rutas base del proyecto; se conecta con admin y con vistas futuras de apps.
urlpatterns = [
    # Admin Django; usa templates y auth configurados en settings.py.
    path("admin/", admin.site.urls),
    # Endpoint SSE para actualizaciones en tiempo real.
    path("realtime/stream/", realtime_stream_view, name="realtime_stream"),
    # Rutas de cuentas; maneja login e inicio del sistema.
    path("", include("cuentas.urls")),
    # Rutas del modulo de personal; creacion de staff.
    path("", include("personal.urls")),
    # Rutas del modulo de usuarios; listado, edicion y masivos.
    path("", include("usuarios.urls")),
    # Rutas del modulo de empresas; listado, edicion y masivos.
    path("", include("empresas.urls")),
    # Rutas del modulo de solicitudes; aprobaciones y rechazos.
    path("", include("solicitudes.urls")),
    # Rutas del modulo de auditoria; registro y consulta.
    path("", include("auditoria.urls")),
    # Rutas del modulo de reportes; resumenes del sistema.
    path("", include("reportes.urls")),
    # Rutas del modulo de terminal SQL; ejecucion para AexfyOwner y Gerente.
    path("", include("terminal.urls")),
]
