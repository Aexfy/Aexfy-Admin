from django.urls import path

from personal import views

# Rutas del modulo de personal; se incluyen en aexfy_admin/urls.py.
urlpatterns = [
    path("staff/crear/", views.crear_staff_view, name="staff_crear"),
    path("staff/creado/", views.staff_creado_view, name="staff_creado"),
]
