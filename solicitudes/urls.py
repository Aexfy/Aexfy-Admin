from django.urls import path

from solicitudes import views

# Rutas del modulo de solicitudes; se incluyen en aexfy_admin/urls.py.
urlpatterns = [
    path("solicitudes/", views.solicitudes_listado_view, name="solicitudes_listado"),
    path("solicitudes/<uuid:solicitud_id>/", views.solicitud_detalle_view, name="solicitud_detalle"),
    path("solicitudes/exportar/", views.solicitudes_exportar_view, name="solicitudes_exportar"),
]
