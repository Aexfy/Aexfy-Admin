from django.urls import path

from cuentas import views

# Rutas de cuentas; se incluyen en aexfy_admin/urls.py.
urlpatterns = [
    # Login principal; renderiza el formulario en templates/cuentas/login.html.
    path("login/", views.login_view, name="login"),
    # Activacion de contrasena desde invitacion de Supabase.
    path("activar/", views.activar_password_view, name="activar_password"),
    # Inicio protegido; requiere sesion activa.
    path("", views.inicio_view, name="inicio"),
    # Logout; limpia sesion local.
    path("salir/", views.logout_view, name="logout"),
]
