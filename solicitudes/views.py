import csv
import logging

from django.http import HttpResponse
from django.shortcuts import redirect, render
from supabase_auth.errors import AuthApiError

from cuentas.decorators import permiso_requerido, sesion_requerida
from cuentas.permisos import puede_asignar_rol_staff
from cuentas.zonas import obtener_zona_sesion, requiere_restriccion_zona
from auditoria.services import registrar_evento_auditoria
from empresas.services import crear_empresa_con_owner_admin
from personal.services import crear_usuario_aexfy, es_error_email_invalido, extraer_mensaje_auth, invitar_usuario_auth, validar_unicidad
from solicitudes.forms import SolicitudesFiltroForm, SolicitudDecisionForm
from solicitudes.services import (
    actualizar_solicitud_admin,
    listar_solicitudes_admin,
    obtener_solicitud_admin,
)

# Logger para errores del modulo de solicitudes.
logger = logging.getLogger(__name__)

# Rol usado para el duenio de empresa.
ROL_OWNER_CLIENTE = "OwnerCliente"


# Listado de solicitudes con filtros simples.
@sesion_requerida
@permiso_requerido("solicitudes")
def solicitudes_listado_view(request):
    form = SolicitudesFiltroForm(request.GET or None)
    filtros = {"estado": "", "tipo": ""}
    if form.is_valid():
        filtros.update(form.cleaned_data)

    solicitudes = []
    try:
        solicitudes = listar_solicitudes_admin(filtros)
    except Exception as exc:
        logger.warning("Error al listar solicitudes: %s", exc)

    # Filtra por zona en memoria usando metadata cuando el rol lo exige.
    roles_sesion = request.session.get("roles") or []
    if requiere_restriccion_zona(roles_sesion):
        zona_sesion = obtener_zona_sesion(request.session)
        if zona_sesion:
            solicitudes = [
                s
                for s in solicitudes
                if (s.get("metadata") or {}).get("p_zona") == zona_sesion
            ]

    mensaje = request.session.pop("solicitud_mensaje", None)

    return render(
        request,
        "solicitudes/listado.html",
        {
            "form_filtros": form,
            "solicitudes": solicitudes,
            "mensaje": mensaje,
        },
    )


# Exporta solicitudes a CSV respetando filtros y restricciones de zona.
@sesion_requerida
@permiso_requerido("solicitudes")
def solicitudes_exportar_view(request):
    form = SolicitudesFiltroForm(request.GET or None)
    filtros = {"estado": "", "tipo": "", "limit": 5000, "offset": 0}
    if form.is_valid():
        filtros.update(form.cleaned_data)

    solicitudes = []
    try:
        solicitudes = listar_solicitudes_admin(filtros)
    except Exception as exc:
        logger.warning("Error al listar solicitudes para exportar: %s", exc)

    roles_sesion = request.session.get("roles") or []
    if requiere_restriccion_zona(roles_sesion):
        zona_sesion = obtener_zona_sesion(request.session)
        if zona_sesion:
            solicitudes = [
                s for s in solicitudes if (s.get("metadata") or {}).get("p_zona") == zona_sesion
            ]

    respuesta = HttpResponse(content_type="text/csv; charset=utf-8")
    respuesta["Content-Disposition"] = "attachment; filename=solicitudes.csv"
    respuesta.write("﻿")

    writer = csv.writer(respuesta, delimiter=';')
    writer.writerow(
        [
            "Fecha",
            "Tipo",
            "Estado",
            "Solicitante",
            "Revisor",
            "Nota",
            "Zona",
        ]
    )
    for solicitud in solicitudes:
        metadata = solicitud.get("metadata") or {}
        writer.writerow(
            [
                solicitud.get("created_at"),
                solicitud.get("request_type"),
                solicitud.get("status"),
                solicitud.get("submitted_email"),
                solicitud.get("reviewed_email"),
                solicitud.get("decision_note"),
                metadata.get("p_zona"),
            ]
        )

    return respuesta


# Detalle de una solicitud con opcion de aprobar o rechazar.
@sesion_requerida
@permiso_requerido("solicitudes")
def solicitud_detalle_view(request, solicitud_id):
    solicitud = obtener_solicitud_admin(str(solicitud_id))
    if not solicitud:
        return redirect("solicitudes_listado")

    # Evita ver solicitudes fuera de la zona asignada.
    roles_sesion = request.session.get("roles") or []
    if requiere_restriccion_zona(roles_sesion):
        zona_sesion = obtener_zona_sesion(request.session)
        if zona_sesion and (solicitud.get("metadata") or {}).get("p_zona") != zona_sesion:
            return render(
                request,
                "cuentas/sin_permisos.html",
                {"permiso": "Ver solicitudes fuera de tu zona", "roles": roles_sesion},
            )

    form = SolicitudDecisionForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        accion = request.POST.get("accion")
        decision_note = form.cleaned_data.get("decision_note")
        usuario = request.session.get("usuario") or {}
        usuario_id = usuario.get("id")

        try:
            # Evita doble aprobacion si la solicitud ya fue resuelta.
            if solicitud.get("status") in {"aprobado", "rechazado"}:
                form.add_error(None, "La solicitud ya fue resuelta.")
                return render(
                    request,
                    "solicitudes/detalle.html",
                    {"solicitud": solicitud, "form": form},
                )

            if accion == "aprobar":
                if solicitud.get("request_type") == "company":
                    metadata = solicitud.get("metadata") or {}

                    # Invita al duenio de la empresa para crear contrasena.
                    nombre_duenio = " ".join(
                        [
                            metadata.get("p_owner_primer_nombre", ""),
                            metadata.get("p_owner_segundo_nombre", ""),
                            metadata.get("p_owner_apellido_paterno", ""),
                            metadata.get("p_owner_apellido_materno", ""),
                        ]
                    ).strip()

                    usuario_auth, enlace = invitar_usuario_auth(
                        metadata.get("p_owner_email"),
                        {
                            "rut": metadata.get("p_owner_rut"),
                            "full_name": nombre_duenio,
                            "role": ROL_OWNER_CLIENTE,
                            "roles": [ROL_OWNER_CLIENTE],
                            "tipo_usuario": "propietario_cliente",
                        },
                    )

                    # Construye payload para crear empresa y duenio en BD.
                    crear_empresa_con_owner_admin(
                        {
                            "p_rut": metadata.get("p_rut"),
                            "p_razon_social": metadata.get("p_razon_social"),
                            "p_nombre_fantasia": metadata.get("p_nombre_fantasia"),
                            "p_giro": metadata.get("p_giro"),
                            "p_segmento_id": int(metadata.get("p_segmento_id")) if metadata.get("p_segmento_id") else None,
                            "p_region_id": int(metadata.get("p_region_id")) if metadata.get("p_region_id") else None,
                            "p_region": metadata.get("p_region"),
                            "p_ciudad": metadata.get("p_ciudad"),
                            "p_comuna": metadata.get("p_comuna"),
                            "p_direccion": metadata.get("p_direccion"),
                            "p_telefono": metadata.get("p_telefono"),
                            "p_email": metadata.get("p_email"),
                            "p_estado": metadata.get("p_estado"),
                            "p_plan": metadata.get("p_plan"),
                            "p_owner_email": metadata.get("p_owner_email"),
                            "p_seller_email": metadata.get("p_seller_email"),
                            "p_zona": metadata.get("p_zona"),
                            "p_owner_auth_id": usuario_auth.id,
                            "p_owner_rut": metadata.get("p_owner_rut"),
                            "p_owner_primer_nombre": metadata.get("p_owner_primer_nombre"),
                            "p_owner_segundo_nombre": metadata.get("p_owner_segundo_nombre"),
                            "p_owner_apellido_paterno": metadata.get("p_owner_apellido_paterno"),
                            "p_owner_apellido_materno": metadata.get("p_owner_apellido_materno"),
                            "p_owner_telefono": metadata.get("p_owner_telefono"),
                            "p_owner_tipo_usuario": "propietario_cliente",
                            "p_owner_rol": ROL_OWNER_CLIENTE,
                        }
                    )

                    # Guarda enlace de invitacion manual si existe.
                    if enlace:
                        request.session["solicitud_mensaje"] = (
                            "Solicitud aprobada. Comparte el enlace de invitacion con el duenio: " + enlace
                        )
                    else:
                        request.session["solicitud_mensaje"] = "Solicitud aprobada y empresa creada."
                elif solicitud.get("request_type") == "staff":
                    metadata = solicitud.get("metadata") or {}
                    rut = metadata.get("p_rut")
                    email = (metadata.get("p_email") or "").lower()
                    telefono = metadata.get("p_telefono")
                    roles_sesion = request.session.get("roles") or []

                    # Valida que el aprobador pueda asignar el rol solicitado.
                    if not puede_asignar_rol_staff(roles_sesion, metadata.get("p_rol", "")):
                        form.add_error(None, "No tienes permisos para aprobar ese rol.")
                        return render(
                            request,
                            "solicitudes/detalle.html",
                            {"solicitud": solicitud, "form": form},
                        )

                    # Valida unicidad antes de crear el usuario.
                    errores = validar_unicidad(rut, email, telefono)
                    if errores:
                        form.add_error(None, "No se puede aprobar: datos ya registrados.")
                        return render(
                            request,
                            "solicitudes/detalle.html",
                            {"solicitud": solicitud, "form": form},
                        )

                    nombre_completo = " ".join(
                        [
                            metadata.get("p_primer_nombre", ""),
                            metadata.get("p_segundo_nombre", ""),
                            metadata.get("p_apellido_paterno", ""),
                            metadata.get("p_apellido_materno", ""),
                        ]
                    ).strip()

                    usuario_auth, enlace = invitar_usuario_auth(
                        email,
                        {
                            "rut": rut,
                            "full_name": nombre_completo,
                            "role": metadata.get("p_rol"),
                            "roles": [metadata.get("p_rol")],
                            "zona": metadata.get("p_zona"),
                        },
                    )

                    # Inserta el usuario staff en la tabla principal.
                    usuario_creado = crear_usuario_aexfy(
                        {
                            "p_auth_id": usuario_auth.id,
                            "p_email": email,
                            "p_nombres": f"{metadata.get('p_primer_nombre', '')} {metadata.get('p_segundo_nombre', '')}".strip(),
                            "p_apellidos": f"{metadata.get('p_apellido_paterno', '')} {metadata.get('p_apellido_materno', '')}".strip(),
                            "p_segundo_nombre": metadata.get("p_segundo_nombre") or None,
                            "p_apellido_materno": metadata.get("p_apellido_materno") or None,
                            "p_rut": rut,
                            "p_tipo_usuario": "staff_aexfy",
                            "p_estado": "activo",
                            "p_telefono": telefono,
                            "p_telefono_emergencia": metadata.get("p_telefono_emergencia") or None,
                            "p_zona": metadata.get("p_zona"),
                            "p_rol": metadata.get("p_rol"),
                        }
                    )

                    if enlace:
                        request.session["solicitud_mensaje"] = (
                            "Solicitud aprobada. Comparte el enlace de invitacion con el usuario: " + enlace
                        )
                    else:
                        request.session["solicitud_mensaje"] = "Solicitud aprobada y usuario creado."

                    registrar_evento_auditoria(
                        usuario,
                        "staff_creado_por_aprobacion",
                        "usuarios",
                        str(usuario_creado.get("id")) if isinstance(usuario_creado, dict) else None,
                        "media",
                        {"email": email, "rol": metadata.get("p_rol"), "zona": metadata.get("p_zona")},
                    )
                else:
                    request.session["solicitud_mensaje"] = "Solicitud aprobada."

                actualizar_solicitud_admin(str(solicitud_id), "aprobado", usuario_id, decision_note)

                # Registra auditoria del aprobado.
                registrar_evento_auditoria(
                    usuario,
                    "solicitud_aprobada",
                    "requests",
                    str(solicitud_id),
                    "media",
                    {"decision_note": decision_note, "request_type": solicitud.get("request_type")},
                )

                return redirect("solicitudes_listado")

            if accion == "rechazar":
                actualizar_solicitud_admin(str(solicitud_id), "rechazado", usuario_id, decision_note)

                # Registra auditoria del rechazo.
                registrar_evento_auditoria(
                    usuario,
                    "solicitud_rechazada",
                    "requests",
                    str(solicitud_id),
                    "media",
                    {"decision_note": decision_note, "request_type": solicitud.get("request_type")},
                )

                request.session["solicitud_mensaje"] = "Solicitud rechazada."
                return redirect("solicitudes_listado")

        except AuthApiError as exc:
            if es_error_email_invalido(exc):
                form.add_error(
                    None,
                    "Correo invalido o no permitido por Supabase. Revisa el formato y la lista de dominios permitidos.",
                )
            else:
                mensaje_error = extraer_mensaje_auth(exc)
                form.add_error(None, f"No se pudo procesar la solicitud. {mensaje_error}")
            logger.warning("Error al procesar solicitud: %s", exc)
        except Exception as exc:
            logger.warning("Error al procesar solicitud: %s", exc)
            form.add_error(None, "No se pudo procesar la solicitud. Revisa los datos.")

    return render(
        request,
        "solicitudes/detalle.html",
        {
            "solicitud": solicitud,
            "form": form,
        },
    )
