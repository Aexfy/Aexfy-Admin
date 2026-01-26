from django.urls import path

from terminal import views

# Rutas para la terminal SQL; se incluyen en aexfy_admin/urls.py.
urlpatterns = [
    path("terminal/", views.terminal_sql_view, name="terminal_sql"),
]
