from django.urls import path

from auditoria import views

# Rutas del modulo de auditoria; se incluyen en aexfy_admin/urls.py.
urlpatterns = [
    path("auditoria/", views.auditoria_listado_view, name="auditoria_listado"),
    path("auditoria/exportar/", views.auditoria_exportar_view, name="auditoria_exportar"),
    path("auditoria/<uuid:evento_id>/", views.auditoria_detalle_view, name="auditoria_detalle"),
]
