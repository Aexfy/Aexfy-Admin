import csv
import logging

from django.conf import settings
from django.views.decorators.cache import never_cache
from django.http import HttpResponse
from django.shortcuts import redirect, render
from supabase_auth.errors import AuthApiError

from cuentas.decorators import permiso_requerido, sesion_requerida
from cuentas.permisos import (
    puede_accion_masiva_usuarios,
    puede_asignar_rol_staff,
    puede_eliminar_usuarios,
)
from cuentas.zonas import aplicar_zona_formulario, obtener_zona_sesion, requiere_restriccion_zona
from auditoria.services import registrar_evento_auditoria
from empresas.services import obtener_roles_usuario_admin
from personal.services import (
    crear_usuario_aexfy,
    es_error_email_invalido,
    extraer_mensaje_auth,
    generar_link_invitacion,
    invitar_usuario_auth,
    validar_unicidad,
)
from solicitudes.services import crear_solicitud_admin
from usuarios.forms import UsuarioCrearForm, UsuarioEditarForm, UsuariosFiltroForm
from usuarios.services import (
    actualizar_usuario_admin,
    actualizar_invite_usuario_admin,
    cambios_masivos_usuarios,
    eliminar_usuario_admin,
    listar_usuarios_admin,
    obtener_usuario_admin,
)

# Logger para registrar errores del modulo de usuarios.
logger = logging.getLogger(__name__)

# Roles con autorizacion directa para crear staff.
ROLES_AUTORIZADOS_STAFF = {"AexfyOwner", "Gerente", "Jefe de soporte", "Jefe RRHH"}


# Determina si el usuario requiere autorizacion para crear staff.
def _requiere_autorizacion(roles: list[str]) -> bool:
    if not roles:
        return True
    return not any(rol in ROLES_AUTORIZADOS_STAFF for rol in roles)


# Obtiene el rol principal desde asignaciones o metadatos.
# La data llega desde usuarios/services.py (RPC listar/obtener definidos en DB_Aexfy.db).
def _obtener_rol_principal(usuario: dict) -> str:
    roles = usuario.get("roles") or []
    if roles:
        return roles[0]
    metadatos = usuario.get("metadatos") or {}
    if isinstance(metadatos, dict):
        rol_directo = metadatos.get("role")
        if rol_directo:
            return str(rol_directo)
        roles_meta = metadatos.get("roles")
        if isinstance(roles_meta, list) and roles_meta:
            return str(roles_meta[0])
        if isinstance(roles_meta, str):
            return roles_meta
    return ""


# Determina si el usuario es AexfyOwner usando roles y metadatos.
# Esto evita exponer al AexfyOwner cuando el rol no existe en asignaciones (solo en metadatos).
def _es_aexfy_owner(usuario: dict) -> bool:
    roles = usuario.get("roles") or []
    if "AexfyOwner" in roles:
        return True
    metadatos = usuario.get("metadatos") or {}
    if isinstance(metadatos, dict):
        if metadatos.get("role") == "AexfyOwner":
            return True
        roles_meta = metadatos.get("roles")
        if isinstance(roles_meta, list) and "AexfyOwner" in roles_meta:
            return True
        if isinstance(roles_meta, str) and roles_meta == "AexfyOwner":
            return True
    return False


# Aplica la regla: AexfyOwner solo visible para AexfyOwner.
# Se usa en listados/exportaciones para cumplir la politica de visibilidad.
def _filtrar_aexfy_owner(usuarios: list[dict], roles_sesion: list[str]) -> list[dict]:
    if "AexfyOwner" in roles_sesion:
        return usuarios
    return [usuario for usuario in usuarios if not _es_aexfy_owner(usuario)]


# Construye un resumen basico de usuario para auditoria masiva.
def _resumen_usuario_auditoria(usuario: dict) -> dict:
    nombres = (usuario.get("nombres") or "").strip()
    apellidos = (usuario.get("apellidos") or "").strip()
    nombre_completo = f"{nombres} {apellidos}".strip()
    return {
        "id": str(usuario.get("id") or ""),
        "rut": usuario.get("rut"),
        "email": usuario.get("email"),
        "nombre": nombre_completo,
        "zona": usuario.get("zona"),
        "rol": _obtener_rol_principal(usuario),
    }


# Lista usuarios con filtros y ejecuta acciones masivas.
@sesion_requerida
@permiso_requerido("usuarios")
@never_cache
def usuarios_listado_view(request):
    mensaje = None
    roles_sesion = request.session.get("roles") or []
    if request.method == "POST":
        # Accion masiva sobre usuarios seleccionados.
        seleccionados = request.POST.getlist("usuarios_seleccionados")
        accion = request.POST.get("accion_masiva")
        valor = request.POST.get("valor_masivo")
        # Fallback si el navegador no actualiza el hidden de valor.
        if not valor and accion:
            if accion == "estado":
                valor = request.POST.get("valor_estado")
            elif accion == "zona":
                valor = request.POST.get("valor_zona")
            elif accion == "rol":
                valor = request.POST.get("valor_rol")
        if seleccionados and accion == "eliminar":
            if not puede_eliminar_usuarios(roles_sesion):
                mensaje = "No tienes permisos para eliminar usuarios."
            else:
                usuario_sesion = request.session.get("usuario") or {}
                zona_sesion = obtener_zona_sesion(request.session)
                eliminados_detalle = []
                omitidos_detalle = []
                eliminados = 0
                omitidos = 0
                errores = 0
                for usuario_id in seleccionados:
                    try:
                        usuario = obtener_usuario_admin(str(usuario_id))
                        if not usuario:
                            omitidos_detalle.append({"id": str(usuario_id), "motivo": "no_encontrado"})
                            omitidos += 1
                            continue
                        detalle = _resumen_usuario_auditoria(usuario)
                        if str(usuario_sesion.get("id")) == str(usuario_id):
                            detalle["motivo"] = "propio_usuario"
                            omitidos_detalle.append(detalle)
                            omitidos += 1
                            continue
                        if _es_aexfy_owner(usuario):
                            # Nunca se elimina AexfyOwner desde acciones masivas.
                            detalle["motivo"] = "aexfy_owner"
                            omitidos_detalle.append(detalle)
                            omitidos += 1
                            continue
                        if requiere_restriccion_zona(roles_sesion):
                            if zona_sesion and usuario.get("zona") and usuario.get("zona") != zona_sesion:
                                detalle["motivo"] = "zona_no_autorizada"
                                omitidos_detalle.append(detalle)
                                omitidos += 1
                                continue
                            rol_objetivo = _obtener_rol_principal(usuario)
                            if rol_objetivo and not puede_asignar_rol_staff(roles_sesion, rol_objetivo):
                                detalle["motivo"] = "rol_no_autorizado"
                                omitidos_detalle.append(detalle)
                                omitidos += 1
                                continue
                        eliminar_usuario_admin(str(usuario_id))
                        eliminados_detalle.append(detalle)
                        eliminados += 1
                    except Exception as exc:
                        errores += 1
                        logger.warning("Error al eliminar usuario masivo: %s", exc)
                        omitidos_detalle.append({"id": str(usuario_id), "motivo": "error"})
                if eliminados:
                    mensaje = f"Usuarios eliminados: {eliminados}."
                else:
                    mensaje = "No se pudo eliminar usuarios."
                if omitidos:
                    mensaje = f"{mensaje} Omitidos: {omitidos}."
                if errores:
                    mensaje = f"{mensaje} Errores: {errores}."
                registrar_evento_auditoria(
                    usuario_sesion,
                    "usuarios_eliminacion_masiva",
                    "usuarios",
                    None,
                    "alta",
                    {
                        "accion": "eliminar",
                        "cantidad": len(seleccionados),
                        "eliminados": eliminados_detalle,
                        "omitidos": omitidos_detalle,
                    },
                )
        elif seleccionados and accion and valor:
            if not puede_accion_masiva_usuarios(roles_sesion):
                mensaje = "No tienes permisos para acciones masivas."
                form_filtros = UsuariosFiltroForm(request.GET or None, roles_sesion=roles_sesion)
                filtros = {
                    "busqueda": "",
                    "estado": "",
                    "tipo_usuario": "",
                    "zona": "",
                    "rol": "",
                }
                if form_filtros.is_valid():
                    filtros.update(form_filtros.cleaned_data)
                if requiere_restriccion_zona(roles_sesion):
                    zona_sesion = obtener_zona_sesion(request.session)
                    if zona_sesion:
                        filtros["zona"] = zona_sesion
                usuarios = listar_usuarios_admin(filtros)
                usuarios = _filtrar_aexfy_owner(usuarios, roles_sesion)
                return render(
                    request,
                    "usuarios/listado.html",
                    {
                        "form_filtros": form_filtros,
                        "usuarios": usuarios,
                        "mensaje": mensaje,
                        "usuario_actual_id": str((request.session.get("usuario") or {}).get("id") or ""),
                        "es_owner": "AexfyOwner" in roles_sesion,
                    },
                )
            try:
                detalles = []
                seleccionados_validos = []
                for usuario_id in seleccionados:
                    usuario = obtener_usuario_admin(str(usuario_id))
                    if not usuario:
                        continue
                    if _es_aexfy_owner(usuario):
                        continue
                    detalles.append(_resumen_usuario_auditoria(usuario))
                    seleccionados_validos.append(str(usuario_id))
                if not seleccionados_validos:
                    mensaje = "No hay usuarios validos para aplicar cambios."
                else:
                    cambios_masivos_usuarios(seleccionados_validos, accion, valor)
                    # Registra auditoria de cambios masivos en usuarios.
                    registrar_evento_auditoria(
                        request.session.get("usuario") or {},
                        "usuarios_cambios_masivos",
                        "usuarios",
                        None,
                        "media",
                        {
                            "accion": accion,
                            "valor": valor,
                            "cantidad": len(seleccionados_validos),
                            "usuarios": detalles,
                        },
                    )
                    mensaje = "Cambios masivos aplicados correctamente."
            except Exception as exc:
                logger.warning("Error en cambios masivos: %s", exc)
                mensaje = "No se pudieron aplicar los cambios masivos."
        else:
            mensaje = "Selecciona usuarios y una accion masiva."
    if not mensaje:
        mensaje = request.session.pop("usuarios_mensaje", None)

    # Filtros por GET para busqueda, estado, tipo, zona y rol.
    form_filtros = UsuariosFiltroForm(request.GET or None, roles_sesion=roles_sesion)
    filtros = {
        "busqueda": "",
        "estado": "",
        "tipo_usuario": "",
        "zona": "",
        "rol": "",
    }
    if form_filtros.is_valid():
        filtros.update(form_filtros.cleaned_data)

    # Paginacion simple para reducir carga.
    per_page = 25
    try:
        page = int(request.GET.get("page", 1) or 1)
    except ValueError:
        page = 1
    page = max(page, 1)
    filtros["limit"] = per_page
    filtros["offset"] = (page - 1) * per_page

    # Limita el listado a la zona del usuario si su rol lo exige.
    roles_sesion = request.session.get("roles") or []
    if requiere_restriccion_zona(roles_sesion):
        zona_sesion = obtener_zona_sesion(request.session)
        if zona_sesion:
            filtros["zona"] = zona_sesion
            aplicar_zona_formulario(form_filtros, zona_sesion)

    usuarios = listar_usuarios_admin(filtros)
    es_owner = "AexfyOwner" in roles_sesion
    usuarios = _filtrar_aexfy_owner(usuarios, roles_sesion)
    has_next = len(usuarios) >= per_page
    qs_base = request.GET.copy()
    qs_base.pop("page", None)

    usuario_sesion = request.session.get("usuario") or {}
    usuario_actual_id = usuario_sesion.get("id")
    if usuario_actual_id:
        usuario_actual_id = str(usuario_actual_id)

    return render(
        request,
        "usuarios/listado.html",
        {
            "form_filtros": form_filtros,
            "usuarios": usuarios,
            "mensaje": mensaje,
            "usuario_actual_id": usuario_actual_id,
            "es_owner": es_owner,
            "page": page,
            "has_next": has_next,
            "qs_base": qs_base,
        },
    )


# Exporta usuarios a CSV respetando filtros y restricciones de zona.
@sesion_requerida
@permiso_requerido("usuarios")
def usuarios_exportar_view(request):
    # Reutiliza los mismos filtros que el listado.
    roles_sesion = request.session.get("roles") or []
    form_filtros = UsuariosFiltroForm(request.GET or None, roles_sesion=roles_sesion)
    filtros = {
        "busqueda": "",
        "estado": "",
        "tipo_usuario": "",
        "zona": "",
        "rol": "",
        "limit": 5000,
        "offset": 0,
    }
    if form_filtros.is_valid():
        filtros.update(form_filtros.cleaned_data)

    # Respeta la restriccion de zona si aplica.
    roles_sesion = request.session.get("roles") or []
    if requiere_restriccion_zona(roles_sesion):
        zona_sesion = obtener_zona_sesion(request.session)
        if zona_sesion:
            filtros["zona"] = zona_sesion

    usuarios = listar_usuarios_admin(filtros)
    usuarios = _filtrar_aexfy_owner(usuarios, roles_sesion)

    # Respuesta CSV con BOM para compatibilidad con Excel.
    respuesta = HttpResponse(content_type="text/csv; charset=utf-8")
    respuesta["Content-Disposition"] = "attachment; filename=usuarios.csv"
    respuesta.write("?")

    writer = csv.writer(respuesta, delimiter=';')
    writer.writerow(
        [
            "RUT",
            "Nombres",
            "Apellidos",
            "Email",
            "Telefono",
            "Estado",
            "Tipo",
            "Zona",
            "Roles",
        ]
    )
    for usuario in usuarios:
        roles = usuario.get("roles") or []
        writer.writerow(
            [
                usuario.get("rut"),
                usuario.get("nombres"),
                usuario.get("apellidos"),
                usuario.get("email"),
                usuario.get("telefono"),
                usuario.get("estado"),
                usuario.get("tipo_usuario"),
                usuario.get("zona"),
                ", ".join(roles),
            ]
        )

    return respuesta


# Crea usuarios de staff y envia invitacion para crear contrasena.
@sesion_requerida
@permiso_requerido("usuarios")
def usuarios_crear_view(request):
    mensaje = None
    if request.method == "POST":
        roles_sesion = request.session.get("roles") or []
        form = UsuarioCrearForm(request.POST, roles_sesion=roles_sesion)
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

            errores = validar_unicidad(rut, email, telefono)
            for campo, mensaje_error in errores.items():
                form.add_error(campo, mensaje_error)

            if not errores:
                try:
                    usuario_sesion = request.session.get("usuario") or {}
                    roles = obtener_roles_usuario_admin(usuario_sesion.get("id")) if usuario_sesion.get("id") else []
                    zona_sesion = obtener_zona_sesion(request.session)

                    # Fuerza zona si el rol requiere restriccion.
                    if requiere_restriccion_zona(roles):
                        if not zona_sesion:
                            form.add_error("zona", "No tienes una zona asignada.")
                            return render(
                                request,
                                "usuarios/crear.html",
                                {"form": form, "mensaje": mensaje, "mostrar_zona": False},
                            )
                        zona = zona_sesion
                        aplicar_zona_formulario(form, zona_sesion)
                    # Para roles superiores no se guarda zona; la zona no aplica al Gerente/AexfyOwner.
                    # La zona nula evita filtros en usuarios/views.py y respeta cuentas/zonas.py.
                    if rol in {"Gerente", "AexfyOwner"}:
                        zona = None

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
                            "usuarios/crear.html",
                            {
                                "form": UsuarioCrearForm(roles_sesion=roles),
                                "mensaje": mensaje,
                                "mostrar_zona": not requiere_restriccion_zona(roles),
                            },
                        )

                    # Valida que el rol asignado sea permitido segun el rol del creador.
                    if not puede_asignar_rol_staff(roles, rol):
                        form.add_error("rol", "No tienes permisos para asignar este rol.")
                        return render(
                            request,
                            "usuarios/crear.html",
                            {"form": form, "mensaje": mensaje, "mostrar_zona": not requiere_restriccion_zona(roles)},
                        )

                    metadata = {
                        "rut": rut,
                        "full_name": f"{primer_nombre} {segundo_nombre} {apellido_paterno} {apellido_materno}".strip(),
                        "role": rol,
                        "roles": [rol],
                        "zona": zona,
                    }

                    usuario_auth, enlace_invitacion = invitar_usuario_auth(email, metadata)

                    nombres_completos = f"{primer_nombre} {segundo_nombre}".strip()
                    apellidos_completos = f"{apellido_paterno} {apellido_materno}".strip()

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

                    # Registra auditoria del usuario creado.
                    registrar_evento_auditoria(
                        request.session.get("usuario") or {},
                        "usuario_creado",
                        "usuarios",
                        str(usuario_creado.get("id")) if isinstance(usuario_creado, dict) else None,
                        "media",
                        {"email": email, "rol": rol, "zona": zona},
                    )

                    if enlace_invitacion:
                        request.session["usuarios_invite_link"] = enlace_invitacion
                        request.session["usuarios_invite_email"] = email

                    return redirect("usuarios_creado")
                except AuthApiError as exc:
                    if es_error_email_invalido(exc):
                        form.add_error(
                            "email",
                            "Correo invalido o no permitido por Supabase. Revisa el formato y la lista de dominios permitidos.",
                        )
                    else:
                        mensaje_error = extraer_mensaje_auth(exc)
                        form.add_error(None, f"No se pudo crear el usuario. {mensaje_error}")
                    logger.warning("Error al crear usuario: %s", exc)
                except Exception as exc:
                    logger.warning("Error al crear usuario: %s", exc)
                    form.add_error(None, "No se pudo crear el usuario. Revisa los datos.")
    else:
        zona_sesion = obtener_zona_sesion(request.session)
        roles_sesion = request.session.get("roles") or []
        form = UsuarioCrearForm(
            initial={"zona": zona_sesion} if zona_sesion else None,
            roles_sesion=roles_sesion,
        )
        if requiere_restriccion_zona(roles_sesion):
            aplicar_zona_formulario(form, zona_sesion)

    return render(
        request,
        "usuarios/crear.html",
        {"form": form, "mensaje": mensaje, "mostrar_zona": not requiere_restriccion_zona(roles_sesion)},
    )


# Vista final al crear usuario, muestra enlace manual si se genero.
@sesion_requerida
@permiso_requerido("usuarios")
def usuarios_creado_view(request):
    enlace = request.session.pop("usuarios_invite_link", None)
    email = request.session.pop("usuarios_invite_email", None)
    return render(
        request,
        "usuarios/creado.html",
        {"enlace_invitacion": enlace, "correo_invitado": email},
    )


# Edita un usuario existente.
@sesion_requerida
@permiso_requerido("usuarios")
def usuarios_editar_view(request, usuario_id):
    usuario = obtener_usuario_admin(str(usuario_id))
    if not usuario:
        return redirect("usuarios_listado")

    # Evita editar usuarios fuera de la zona asignada.
    roles_sesion = request.session.get("roles") or []
    if _es_aexfy_owner(usuario) and "AexfyOwner" not in roles_sesion:
        return render(
            request,
            "cuentas/sin_permisos.html",
            {"permiso": "Editar AexfyOwner", "roles": roles_sesion},
        )
    if requiere_restriccion_zona(roles_sesion):
        zona_sesion = obtener_zona_sesion(request.session)
        if zona_sesion and usuario.get("zona") and usuario.get("zona") != zona_sesion:
            return render(
                request,
                "cuentas/sin_permisos.html",
                {"permiso": "Editar usuarios fuera de tu zona", "roles": roles_sesion},
            )
        # Evita editar usuarios de rol no permitido para Supervisor.
        rol_objetivo = _obtener_rol_principal(usuario)
        if rol_objetivo and not puede_asignar_rol_staff(roles_sesion, rol_objetivo):
            return render(
                request,
                "cuentas/sin_permisos.html",
                {"permiso": "Editar usuarios de roles no autorizados", "roles": roles_sesion},
            )

    mensaje_invite = request.session.pop("usuarios_invite_mensaje", None)
    invite_link = usuario.get("invite_link")
    enlace_sesion = request.session.pop("usuarios_invite_link", None)
    if enlace_sesion:
        invite_link = enlace_sesion
    if not invite_link and isinstance(usuario.get("metadatos"), dict):
        invite_link = usuario.get("metadatos", {}).get("invite_link")

    # Separa nombres y apellidos para el formulario.
    nombres = usuario.get("nombres") or ""
    apellidos = usuario.get("apellidos") or ""
    segundo_nombre = usuario.get("segundo_nombre") or ""
    apellido_materno = usuario.get("apellido_materno") or ""

    primer_nombre = nombres
    if segundo_nombre and nombres.endswith(segundo_nombre):
        primer_nombre = nombres[: -len(segundo_nombre)].strip()
    apellido_paterno = apellidos
    if apellido_materno and apellidos.endswith(apellido_materno):
        apellido_paterno = apellidos[: -len(apellido_materno)].strip()

    rol_actual = _obtener_rol_principal(usuario)

    if request.method == "POST":
        form = UsuarioEditarForm(request.POST, roles_sesion=roles_sesion)
        if form.is_valid():
            roles_sesion = request.session.get("roles") or []
            # Valida rol permitido al editar.
            if not puede_asignar_rol_staff(roles_sesion, form.cleaned_data["rol"]):
                form.add_error("rol", "No tienes permisos para asignar este rol.")
                return render(
                    request,
                    "usuarios/editar.html",
                    {
                        "form": form,
                        "usuario": usuario,
                        "invite_link": invite_link,
                        "mensaje_invite": mensaje_invite,
                        "mostrar_zona": not requiere_restriccion_zona(roles_sesion),
                    },
                )
            primer_nombre = form.cleaned_data["primer_nombre"]
            segundo_nombre = form.cleaned_data["segundo_nombre"]
            apellido_paterno = form.cleaned_data["apellido_paterno"]
            apellido_materno = form.cleaned_data["apellido_materno"]
            # Para Gerente/AexfyOwner se limpia la zona, ya que el rol gobierna el acceso.
            # Se guarda nulo para evitar filtrado por zona en listados/exportaciones.
            zona_edicion = form.cleaned_data["zona"]
            if form.cleaned_data["rol"] in {"Gerente", "AexfyOwner"}:
                zona_edicion = None
            nombres_completos = f"{primer_nombre} {segundo_nombre}".strip()
            apellidos_completos = f"{apellido_paterno} {apellido_materno}".strip()

            try:
                actualizar_usuario_admin(
                    {
                        "p_usuario_id": str(usuario_id),
                        "p_email": usuario.get("email") or form.cleaned_data["email"],
                        "p_nombres": nombres_completos,
                        "p_apellidos": apellidos_completos,
                        "p_segundo_nombre": segundo_nombre or None,
                        "p_apellido_materno": apellido_materno or None,
                        "p_rut": form.cleaned_data["rut"],
                        "p_tipo_usuario": form.cleaned_data["tipo_usuario"],
                        "p_estado": form.cleaned_data["estado"],
                        "p_telefono": form.cleaned_data["telefono"],
                        "p_telefono_emergencia": form.cleaned_data["telefono_emergencia"],
                        "p_zona": zona_edicion,
                        "p_rol": form.cleaned_data["rol"],
                    }
                )
                # Registra auditoria de actualizacion de usuario.
                registrar_evento_auditoria(
                    request.session.get("usuario") or {},
                    "usuario_actualizado",
                    "usuarios",
                    str(usuario_id),
                    "media",
                    {"email": form.cleaned_data["email"], "rol": form.cleaned_data["rol"], "zona": zona_edicion},
                )
                return redirect("usuarios_listado")
            except Exception as exc:
                logger.warning("Error al editar usuario: %s", exc)
                form.add_error(None, "No se pudo actualizar el usuario.")
    else:
        form = UsuarioEditarForm(
            initial={
                "rut": usuario.get("rut"),
                "email": usuario.get("email"),
                "primer_nombre": primer_nombre,
                "segundo_nombre": segundo_nombre,
                "apellido_paterno": apellido_paterno,
                "apellido_materno": apellido_materno,
                "telefono": (usuario.get("telefono") or "").replace("+56 ", ""),
                "telefono_emergencia": (usuario.get("telefono_emergencia") or "").replace("+56 ", ""),
                "estado": usuario.get("estado"),
                "tipo_usuario": usuario.get("tipo_usuario"),
                "zona": usuario.get("zona") or "NG",
                "rol": rol_actual,
            },
            roles_sesion=roles_sesion,
        )
        if requiere_restriccion_zona(roles_sesion):
            aplicar_zona_formulario(form, usuario.get("zona"))

    return render(
        request,
        "usuarios/editar.html",
        {
            "form": form,
            "usuario": usuario,
            "invite_link": invite_link,
            "mensaje_invite": mensaje_invite,
            "mostrar_zona": not requiere_restriccion_zona(roles_sesion),
        },
    )


# Reenvia invitacion para que el usuario cree su contrasena.
@sesion_requerida
@permiso_requerido("usuarios")
def usuarios_invitar_view(request, usuario_id):
    if request.method != "POST":
        return redirect("usuarios_editar", usuario_id=usuario_id)

    usuario = obtener_usuario_admin(str(usuario_id))
    if not usuario:
        return redirect("usuarios_listado")

    # Evita reenviar invitacion si el usuario pertenece a otra zona.
    roles_sesion = request.session.get("roles") or []
    if _es_aexfy_owner(usuario) and "AexfyOwner" not in roles_sesion:
        return render(
            request,
            "cuentas/sin_permisos.html",
            {"permiso": "Reenviar invitacion AexfyOwner", "roles": roles_sesion},
        )
    if requiere_restriccion_zona(roles_sesion):
        zona_sesion = obtener_zona_sesion(request.session)
        if zona_sesion and usuario.get("zona") and usuario.get("zona") != zona_sesion:
            return render(
                request,
                "cuentas/sin_permisos.html",
                {"permiso": "Reenviar invitacion fuera de tu zona", "roles": roles_sesion},
            )

    email = (usuario.get("email") or "").strip().lower()
    rol = _obtener_rol_principal(usuario)
    nombre_completo = f"{usuario.get('nombres', '')} {usuario.get('apellidos', '')}".strip()

    metadata = {
        "rut": usuario.get("rut"),
        "full_name": nombre_completo,
        "role": rol,
        "roles": [rol] if rol else [],
        "zona": usuario.get("zona"),
    }

    try:
        _, enlace = generar_link_invitacion(email, metadata)
        if enlace:
            actualizar_invite_usuario_admin(str(usuario_id), enlace)
            request.session["usuarios_invite_mensaje"] = "Enlace de invitacion generado."
            request.session["usuarios_invite_link"] = enlace
        else:
            request.session["usuarios_invite_mensaje"] = "No se pudo generar el enlace de invitacion."
    except AuthApiError as exc:
        if es_error_email_invalido(exc):
            request.session["usuarios_invite_mensaje"] = (
                "Correo invalido o no permitido por Supabase. Revisa el formato y la lista de dominios permitidos."
            )
        else:
            mensaje_error = extraer_mensaje_auth(exc)
            request.session["usuarios_invite_mensaje"] = f"No se pudo generar el enlace. {mensaje_error}"
        logger.warning("Error al reenviar invitacion: %s", exc)
    except Exception as exc:
        request.session["usuarios_invite_mensaje"] = "No se pudo generar el enlace de invitacion."
        logger.warning("Error al reenviar invitacion: %s", exc)

    return redirect("usuarios_editar", usuario_id=usuario_id)


# Elimina un usuario (solo Supervisor o superior).
@sesion_requerida
@permiso_requerido("usuarios")
def usuarios_eliminar_view(request, usuario_id):
    if request.method != "POST":
        return redirect("usuarios_listado")

    roles_sesion = request.session.get("roles") or []
    if not puede_eliminar_usuarios(roles_sesion):
        return render(
            request,
            "cuentas/sin_permisos.html",
            {"permiso": "Eliminar usuarios", "roles": roles_sesion},
        )

    usuario = obtener_usuario_admin(str(usuario_id))
    if not usuario:
        return redirect("usuarios_listado")

    usuario_sesion = request.session.get("usuario") or {}
    if str(usuario_sesion.get("id")) == str(usuario_id):
        request.session["usuarios_mensaje"] = "No puedes eliminar tu propio usuario."
        return redirect("usuarios_listado")

    if _es_aexfy_owner(usuario) and "AexfyOwner" not in roles_sesion:
        return render(
            request,
            "cuentas/sin_permisos.html",
            {"permiso": "Eliminar AexfyOwner", "roles": roles_sesion},
        )

    if requiere_restriccion_zona(roles_sesion):
        zona_sesion = obtener_zona_sesion(request.session)
        if zona_sesion and usuario.get("zona") and usuario.get("zona") != zona_sesion:
            return render(
                request,
                "cuentas/sin_permisos.html",
                {"permiso": "Eliminar usuarios fuera de tu zona", "roles": roles_sesion},
            )
        rol_objetivo = _obtener_rol_principal(usuario)
        if rol_objetivo and not puede_asignar_rol_staff(roles_sesion, rol_objetivo):
            return render(
                request,
                "cuentas/sin_permisos.html",
                {"permiso": "Eliminar usuarios de roles no autorizados", "roles": roles_sesion},
            )

    try:
        eliminar_usuario_admin(str(usuario_id))
        registrar_evento_auditoria(
            usuario_sesion,
            "usuario_eliminado",
            "usuarios",
            str(usuario_id),
            "alta",
            {"email": usuario.get("email"), "rut": usuario.get("rut")},
        )
        request.session["usuarios_mensaje"] = "Usuario eliminado correctamente."
    except Exception as exc:
        logger.warning("Error al eliminar usuario: %s", exc)
        if settings.DEBUG:
            request.session["usuarios_mensaje"] = f"No se pudo eliminar el usuario. {exc}"
        else:
            request.session["usuarios_mensaje"] = "No se pudo eliminar el usuario."

    return redirect("usuarios_listado")


