from django.urls import path

from reportes import views

# Rutas del modulo de reportes; se incluyen en aexfy_admin/urls.py.
urlpatterns = [
    path("reportes/", views.reportes_listado_view, name="reportes_listado"),
]
