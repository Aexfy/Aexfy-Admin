import csv
import logging

from django.http import HttpResponse
from django.shortcuts import render

from cuentas.decorators import permiso_requerido, sesion_requerida
from auditoria.forms import AuditoriaFiltroForm
from auditoria.services import listar_auditoria_admin, obtener_auditoria_admin

# Logger para errores del modulo de auditoria.
logger = logging.getLogger(__name__)


# Exporta eventos de auditoria a CSV.
@sesion_requerida
@permiso_requerido("auditoria")
def auditoria_exportar_view(request):
    form = AuditoriaFiltroForm(request.GET or None)
    filtros = {"busqueda": "", "severidad": "", "fecha_desde": None, "fecha_hasta": None}
    if form.is_valid():
        filtros.update(form.cleaned_data)

    eventos = []
    try:
        eventos = listar_auditoria_admin(filtros)
    except Exception as exc:
        logger.warning("Error al listar auditoria para exportar: %s", exc)

    respuesta = HttpResponse(content_type="text/csv; charset=utf-8")
    respuesta["Content-Disposition"] = "attachment; filename=auditoria.csv"
    respuesta.write("﻿")

    writer = csv.writer(respuesta, delimiter=';')
    writer.writerow(
        [
            "Fecha",
            "Actor",
            "Accion",
            "Entidad",
            "Entidad ID",
            "Severidad",
        ]
    )
    for evento in eventos:
        writer.writerow(
            [
                evento.get("created_at"),
                evento.get("actor_email"),
                evento.get("action"),
                evento.get("entity"),
                evento.get("entity_id"),
                evento.get("severity"),
            ]
        )

    return respuesta


# Listado de eventos de auditoria con filtros basicos.
@sesion_requerida
@permiso_requerido("auditoria")
def auditoria_listado_view(request):
    form = AuditoriaFiltroForm(request.GET or None)
    filtros = {"busqueda": "", "severidad": "", "fecha_desde": None, "fecha_hasta": None}
    if form.is_valid():
        filtros.update(form.cleaned_data)

    eventos = []
    try:
        eventos = listar_auditoria_admin(filtros)
    except Exception as exc:
        logger.warning("Error al listar auditoria: %s", exc)

    return render(
        request,
        "auditoria/listado.html",
        {
            "form_filtros": form,
            "eventos": eventos,
        },
    )


# Detalle de un evento de auditoria (incluye masivos).
@sesion_requerida
@permiso_requerido("auditoria")
def auditoria_detalle_view(request, evento_id):
    evento = None
    try:
        evento = obtener_auditoria_admin(str(evento_id))
    except Exception as exc:
        logger.warning("Error al obtener detalle de auditoria: %s", exc)

    if not evento:
        return render(
            request,
            "auditoria/detalle.html",
            {"evento": None},
        )

    metadatos = evento.get("metadatos") or {}
    usuarios = metadatos.get("usuarios") or []
    empresas = metadatos.get("empresas") or []
    eliminados = metadatos.get("eliminados") or []
    omitidos = metadatos.get("omitidos") or []

    return render(
        request,
        "auditoria/detalle.html",
        {
            "evento": evento,
            "metadatos": metadatos,
            "usuarios": usuarios,
            "empresas": empresas,
            "eliminados": eliminados,
            "omitidos": omitidos,
        },
    )
