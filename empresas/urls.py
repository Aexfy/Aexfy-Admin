from django.urls import path

from empresas import views

# Rutas del modulo de empresas; se incluyen en aexfy_admin/urls.py.
urlpatterns = [
    path("empresas/", views.empresas_listado_view, name="empresas_listado"),
    path("empresas/crear/", views.empresas_crear_view, name="empresas_crear"),
    path("empresas/creado/", views.empresas_creado_view, name="empresas_creado"),
    path("empresas/<uuid:empresa_id>/editar/", views.empresas_editar_view, name="empresas_editar"),
    path("empresas/<uuid:empresa_id>/eliminar/", views.empresas_eliminar_view, name="empresas_eliminar"),
    path("empresas/exportar/", views.empresas_exportar_view, name="empresas_exportar"),
]
