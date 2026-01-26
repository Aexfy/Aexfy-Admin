from django.urls import path

from usuarios import views

# Rutas del modulo de usuarios; se incluyen en aexfy_admin/urls.py.
urlpatterns = [
    path("usuarios/", views.usuarios_listado_view, name="usuarios_listado"),
    path("usuarios/crear/", views.usuarios_crear_view, name="usuarios_crear"),
    path("usuarios/creado/", views.usuarios_creado_view, name="usuarios_creado"),
    path("usuarios/<uuid:usuario_id>/editar/", views.usuarios_editar_view, name="usuarios_editar"),
    path("usuarios/<uuid:usuario_id>/invitar/", views.usuarios_invitar_view, name="usuarios_invitar"),
    path("usuarios/<uuid:usuario_id>/eliminar/", views.usuarios_eliminar_view, name="usuarios_eliminar"),
    path("usuarios/exportar/", views.usuarios_exportar_view, name="usuarios_exportar"),
]
