import logging

from django.shortcuts import redirect, render
from supabase_auth.errors import AuthApiError

from cuentas.decorators import permiso_requerido, sesion_requerida
from cuentas.permisos import puede_asignar_rol_staff
from cuentas.zonas import aplicar_zona_formulario, obtener_zona_sesion, requiere_restriccion_zona
from auditoria.services import registrar_evento_auditoria
from empresas.services import obtener_roles_usuario_admin
from personal.forms import CrearStaffForm
from personal.services import crear_usuario_aexfy, es_error_email_invalido, extraer_mensaje_auth, invitar_usuario_auth, validar_unicidad
from solicitudes.services import crear_solicitud_admin

# Logger para errores de creacion de staff.
logger = logging.getLogger(__name__)

# Roles con autorizacion directa para crear staff.
ROLES_AUTORIZADOS_STAFF = {"AexfyOwner", "Gerente", "Jefe de soporte", "Jefe RRHH"}


# Determina si el usuario requiere autorizacion para crear staff.
def _requiere_autorizacion(roles: list[str]) -> bool:
    if not roles:
        return True
    return not any(rol in ROLES_AUTORIZADOS_STAFF for rol in roles)


# Vista para crear usuarios de staff; usa invitacion en Supabase Auth.
@sesion_requerida
@permiso_requerido("staff")
def crear_staff_view(request):
    mensaje = None
    if request.method == "POST":
        roles_sesion = request.session.get("roles") or []
        form = CrearStaffForm(request.POST, roles_sesion=roles_sesion)
        if form.is_valid():
            rut = form.cleaned_data["rut"]
            email = form.cleaned_data["email"].lower()
            primer_nombre = form.cleaned_data["primer_nombre"]
            segundo_nombre = form.cleaned_data["segundo_nombre"]
            apellido_paterno = form.cleaned_data["apellido_paterno"]
            apellido_materno = form.cleaned_data["apellido_materno"]
            telefono = form.cleaned_data["telefono"]
            telefono_emergencia = form.cleaned_data["telefono_emergencia"]
            rol = form.cleaned_data["rol"]
            zona = form.cleaned_data["zona"]

            # Valida unicidad en BD antes de crear Auth.
            errores = validar_unicidad(rut, email, telefono)
            for campo, mensaje_error in errores.items():
                form.add_error(campo, mensaje_error)

            if not errores:
                try:
                    usuario_sesion = request.session.get("usuario") or {}
                    roles = obtener_roles_usuario_admin(usuario_sesion.get("id")) if usuario_sesion.get("id") else []
                    zona_sesion = obtener_zona_sesion(request.session)

                    # Si el rol requiere zona, fuerza la zona desde la sesion.
                    if requiere_restriccion_zona(roles):
                        if not zona_sesion:
                            form.add_error("zona", "No tienes una zona asignada.")
                            return render(
                                request,
                                "personal/crear_staff.html",
                                {"form": form, "mensaje": mensaje, "mostrar_zona": False},
                            )
                        zona = zona_sesion
                        aplicar_zona_formulario(form, zona_sesion)
                    # Para roles superiores no se guarda zona; el acceso no depende de ella.
                    # Esto alinea el comportamiento con cuentas/zonas.py y los listados en usuarios/views.py.
                    if rol in {"Gerente", "AexfyOwner"}:
                        zona = None

                    # Si requiere autorizacion, crea una solicitud en vez de crear el usuario.
                    if _requiere_autorizacion(roles):
                        crear_solicitud_admin(
                            {
                                "request_type": "staff",
                                "status": "pendiente",
                                "metadata": {
                                    "p_rut": rut,
                                    "p_email": email,
                                    "p_primer_nombre": primer_nombre,
                                    "p_segundo_nombre": segundo_nombre,
                                    "p_apellido_paterno": apellido_paterno,
                                    "p_apellido_materno": apellido_materno,
                                    "p_telefono": telefono,
                                    "p_telefono_emergencia": telefono_emergencia,
                                    "p_rol": rol,
                                    "p_zona": zona,
                                    "solicitado_por": usuario_sesion.get("id"),
                                    "roles_solicitante": roles,
                                },
                                "submitted_by": usuario_sesion.get("id"),
                            }
                        )

                        registrar_evento_auditoria(
                            usuario_sesion,
                            "staff_solicitud_creada",
                            "requests",
                            None,
                            "media",
                            {"email": email, "rol": rol, "zona": zona},
                        )

                        mensaje = "Solicitud enviada para autorizacion."
                        return render(
                            request,
                            "personal/crear_staff.html",
                            {
                                "form": CrearStaffForm(roles_sesion=roles),
                                "mensaje": mensaje,
                                "mostrar_zona": not requiere_restriccion_zona(roles),
                            },
                        )

                    # Valida que el rol asignado sea permitido segun el rol del creador.
                    if not puede_asignar_rol_staff(roles, rol):
                        form.add_error("rol", "No tienes permisos para asignar este rol.")
                        return render(
                            request,
                            "personal/crear_staff.html",
                            {
                                "form": form,
                                "mensaje": mensaje,
                                "mostrar_zona": not requiere_restriccion_zona(roles),
                            },
                        )

                    # Metadata compartida entre Auth y aexfy.usuarios.
                    metadata = {
                        "rut": rut,
                        "full_name": f"{primer_nombre} {segundo_nombre} {apellido_paterno} {apellido_materno}".strip(),
                        "role": rol,
                        "roles": [rol],
                        "zona": zona,
                    }

                    # Invita al usuario por correo para que cree su contrasena.
                    usuario_auth, enlace_invitacion = invitar_usuario_auth(email, metadata)

                    # Construye nombres y apellidos completos para la tabla.
                    nombres_completos = f"{primer_nombre} {segundo_nombre}".strip()
                    apellidos_completos = f"{apellido_paterno} {apellido_materno}".strip()

                    # Inserta en aexfy.usuarios con campos adicionales.
                    usuario_creado = crear_usuario_aexfy(
                        {
                            "p_auth_id": usuario_auth.id,
                            "p_email": email,
                            "p_nombres": nombres_completos,
                            "p_apellidos": apellidos_completos,
                            "p_segundo_nombre": segundo_nombre or None,
                            "p_apellido_materno": apellido_materno or None,
                            "p_rut": rut,
                            "p_tipo_usuario": "staff_aexfy",
                            "p_estado": "activo",
                            "p_telefono": telefono,
                            "p_telefono_emergencia": telefono_emergencia or None,
                            "p_zona": zona,
                            "p_rol": rol,
                        }
                    )

                    # Registra auditoria con el actor desde la sesion.
                    registrar_evento_auditoria(
                        usuario_sesion,
                        "staff_creado",
                        "usuarios",
                        str(usuario_creado.get("id")) if isinstance(usuario_creado, dict) else None,
                        "media",
                        {"email": email, "rol": rol, "zona": zona},
                    )

                    # Guarda el enlace si se genero manualmente por limite de correos.
                    if enlace_invitacion:
                        request.session["staff_invite_link"] = enlace_invitacion
                        request.session["staff_invite_email"] = email

                        return redirect("staff_creado")
                except AuthApiError as exc:
                    if es_error_email_invalido(exc):
                        form.add_error(
                            "email",
                            "Correo invalido o no permitido por Supabase. Revisa el formato y la lista de dominios permitidos.",
                        )
                    else:
                        mensaje_error = extraer_mensaje_auth(exc)
                        form.add_error(None, f"No se pudo crear el usuario. {mensaje_error}")
                    logger.warning("Error al crear staff: %s", exc)
                except Exception as exc:
                    # Registra el error para depuracion y muestra mensaje generico.
                    logger.warning("Error al crear staff: %s", exc)
                    form.add_error(None, "No se pudo crear el usuario. Revisa los datos.")
    else:
        zona_sesion = obtener_zona_sesion(request.session)
        roles_sesion = request.session.get("roles") or []
        form = CrearStaffForm(
            initial={"zona": zona_sesion} if zona_sesion else None,
            roles_sesion=roles_sesion,
        )
        if requiere_restriccion_zona(roles_sesion):
            aplicar_zona_formulario(form, zona_sesion)

    return render(
        request,
        "personal/crear_staff.html",
        {"form": form, "mensaje": mensaje, "mostrar_zona": not requiere_restriccion_zona(roles_sesion)},
    )


# Vista simple de confirmacion luego de crear un staff.
@sesion_requerida
@permiso_requerido("staff")
def staff_creado_view(request):
    # Recupera enlace de invitacion si se genero manualmente por limite de correos.
    enlace = request.session.pop("staff_invite_link", None)
    email = request.session.pop("staff_invite_email", None)
    return render(
        request,
        "personal/staff_creado.html",
        {"enlace_invitacion": enlace, "correo_invitado": email},
    )
