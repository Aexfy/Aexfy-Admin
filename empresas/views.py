import csv
import logging

from django.http import HttpResponse
from django.views.decorators.cache import never_cache
from django.shortcuts import redirect, render

from cuentas.decorators import permiso_requerido, sesion_requerida
from cuentas.permisos import (
    puede_accion_masiva_empresas,
    puede_editar_empresas,
    puede_eliminar_empresas,
)
from cuentas.zonas import aplicar_zona_formulario, obtener_zona_sesion, requiere_restriccion_zona
from auditoria.services import registrar_evento_auditoria
from personal.services import existe_usuario_auth_por_email, invitar_usuario_auth, validar_unicidad
from empresas.forms import EmpresaCrearForm, EmpresaEditarForm, EmpresasFiltroForm
from empresas.services import (
    actualizar_empresa_admin,
    cambios_masivos_empresas,
    crear_empresa_admin,
    crear_empresa_con_owner_admin,
    crear_solicitud_empresa_admin,
    eliminar_empresa_admin,
    listar_empresas_admin,
    listar_regiones_admin,
    listar_segmentos_admin,
    obtener_empresa_admin,
    obtener_roles_usuario_admin,
)

# Logger para errores del modulo de empresas.
logger = logging.getLogger(__name__)


# Roles que pueden crear empresas sin autorizacion previa.
ROLES_AUTORIZADOS_DIRECTO = {"AexfyOwner", "Gerente", "Jefe de soporte", "Jefe RRHH"}
ROL_OWNER_CLIENTE = "OwnerCliente"


# Determina si el usuario requiere autorizacion para crear empresas.
def _requiere_autorizacion(roles: list[str]) -> bool:
    # Si no hay roles, se exige autorizacion por seguridad.
    if not roles:
        return True
    return not any(rol in ROLES_AUTORIZADOS_DIRECTO for rol in roles)


# Construye un resumen basico de empresa para auditoria masiva.
def _resumen_empresa_auditoria(empresa: dict) -> dict:
    return {
        "id": str(empresa.get("id") or ""),
        "rut": empresa.get("rut"),
        "razon_social": empresa.get("razon_social"),
        "email": empresa.get("email"),
        "zona": empresa.get("zona"),
        "plan": empresa.get("plan"),
        "estado": empresa.get("estado"),
    }


# Listado con filtros y acciones masivas para empresas.
@sesion_requerida
@permiso_requerido("empresas")
@never_cache
def empresas_listado_view(request):
    mensaje = None
    if request.method == "POST":
        seleccionados = request.POST.getlist("empresas_seleccionadas")
        accion = request.POST.get("accion_masiva")
        valor = request.POST.get("valor_masivo")
        # Fallback si el hidden no se actualizo.
        if not valor and accion:
            if accion == "estado":
                valor = request.POST.get("valor_estado")
            elif accion == "plan":
                valor = request.POST.get("valor_plan")
            elif accion == "zona":
                valor = request.POST.get("valor_zona")

        roles_sesion = request.session.get("roles") or []
        if seleccionados and accion and valor:
            if not puede_accion_masiva_empresas(roles_sesion):
                mensaje = "No tienes permisos para acciones masivas."
                form_filtros = EmpresasFiltroForm(request.GET or None)
                filtros = {
                    "busqueda": "",
                    "estado": "",
                    "plan": "",
                    "zona": "",
                }
                if form_filtros.is_valid():
                    filtros.update(form_filtros.cleaned_data)
                if requiere_restriccion_zona(roles_sesion):
                    zona_sesion = obtener_zona_sesion(request.session)
                    if zona_sesion:
                        filtros["zona"] = zona_sesion
                empresas = listar_empresas_admin(filtros)
                return render(
                    request,
                    "empresas/listado.html",
                    {
                        "form_filtros": form_filtros,
                        "empresas": empresas,
                        "mensaje": mensaje,
                    },
                )
            try:
                detalles = []
                seleccionados_validos = []
                for empresa_id in seleccionados:
                    empresa = obtener_empresa_admin(str(empresa_id))
                    if not empresa:
                        continue
                    detalles.append(_resumen_empresa_auditoria(empresa))
                    seleccionados_validos.append(str(empresa_id))

                if not seleccionados_validos:
                    mensaje = "No hay empresas validas para aplicar cambios."
                else:
                    cambios_masivos_empresas(seleccionados_validos, accion, valor)
                    # Registra auditoria de cambios masivos en empresas.
                    registrar_evento_auditoria(
                        request.session.get("usuario") or {},
                        "empresas_cambios_masivos",
                        "clientes",
                        None,
                        "media",
                        {
                            "accion": accion,
                            "valor": valor,
                            "cantidad": len(seleccionados_validos),
                            "empresas": detalles,
                        },
                    )
                    mensaje = "Cambios masivos aplicados correctamente."
            except Exception as exc:
                logger.warning("Error en cambios masivos empresas: %s", exc)
                mensaje = "No se pudieron aplicar los cambios masivos."
        else:
            mensaje = "Selecciona empresas y una accion masiva."
    if not mensaje:
        mensaje = request.session.pop("empresa_mensaje", None)

    form_filtros = EmpresasFiltroForm(request.GET or None)
    filtros = {
        "busqueda": "",
        "estado": "",
        "plan": "",
        "zona": "",
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

    empresas = listar_empresas_admin(filtros)
    has_next = len(empresas) >= per_page
    qs_base = request.GET.copy()
    qs_base.pop("page", None)

    return render(
        request,
        "empresas/listado.html",
        {
            "form_filtros": form_filtros,
            "empresas": empresas,
            "mensaje": mensaje,
            "page": page,
            "has_next": has_next,
            "qs_base": qs_base,
        },
    )


# Exporta empresas a CSV respetando filtros y restricciones de zona.
@sesion_requerida
@permiso_requerido("empresas")
def empresas_exportar_view(request):
    form_filtros = EmpresasFiltroForm(request.GET or None)
    filtros = {
        "busqueda": "",
        "estado": "",
        "plan": "",
        "zona": "",
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

    empresas = listar_empresas_admin(filtros)

    respuesta = HttpResponse(content_type="text/csv; charset=utf-8")
    respuesta["Content-Disposition"] = "attachment; filename=empresas.csv"
    respuesta.write("\ufeff")

    writer = csv.writer(respuesta, delimiter=';')
    writer.writerow(
        [
            "RUT",
            "Codigo",
            "Razon social",
            "Nombre fantasia",
            "Email",
            "Telefono",
            "Estado",
            "Plan",
            "Zona",
        ]
    )
    for empresa in empresas:
        writer.writerow(
            [
                empresa.get("rut"),
                empresa.get("company_code"),
                empresa.get("razon_social"),
                empresa.get("nombre_fantasia"),
                empresa.get("email"),
                empresa.get("telefono"),
                empresa.get("estado"),
                empresa.get("plan"),
                empresa.get("zona"),
            ]
        )

    return respuesta


# Crea una nueva empresa con codigo interno automatico.
@sesion_requerida
@permiso_requerido("empresas")
def empresas_crear_view(request):
    segmentos = listar_segmentos_admin()
    regiones = listar_regiones_admin()
    regiones_map = {str(r.get("id")): r.get("nombre") for r in regiones}

    if request.method == "POST":
        form = EmpresaCrearForm(request.POST, segmentos=segmentos, regiones=regiones)
        if form.is_valid():
            try:
                usuario = request.session.get("usuario") or {}
                usuario_id = usuario.get("id")
                seller_email = usuario.get("email")
                roles = obtener_roles_usuario_admin(usuario_id) if usuario_id else []
                zona_sesion = obtener_zona_sesion(request.session)

                region_id = str(form.cleaned_data["region_id"]) if form.cleaned_data["region_id"] else ""
                # Validacion de unicidad para el usuario duenio usando la RPC de DB_Aexfy.db.
                errores_duenio = validar_unicidad(
                    form.cleaned_data["owner_rut"],
                    form.cleaned_data["owner_email"],
                    form.cleaned_data["owner_telefono"],
                )
                if errores_duenio:
                    if "rut" in errores_duenio:
                        form.add_error("owner_rut", errores_duenio["rut"])
                    if "email" in errores_duenio:
                        form.add_error("owner_email", errores_duenio["email"])
                    if "telefono" in errores_duenio:
                        form.add_error("owner_telefono", errores_duenio["telefono"])
                    return render(request, "empresas/crear.html", {"form": form})

                # Valida contra Auth para evitar crear/invitar correos ya existentes en Supabase.
                # Se apoya en personal/services.py para consultar Auth antes de llamar la RPC.
                if existe_usuario_auth_por_email(form.cleaned_data["owner_email"]):
                    form.add_error("owner_email", "El correo del dueño ya está registrado.")
                    return render(request, "empresas/crear.html", {"form": form})

                datos_empresa = {
                    "p_rut": form.cleaned_data["rut"],
                    "p_razon_social": form.cleaned_data["razon_social"],
                    "p_nombre_fantasia": form.cleaned_data["nombre_fantasia"],
                    "p_giro": form.cleaned_data["giro"],
                    "p_segmento_id": int(form.cleaned_data["segmento_id"]) if form.cleaned_data["segmento_id"] else None,
                    "p_region_id": int(form.cleaned_data["region_id"]) if form.cleaned_data["region_id"] else None,
                    "p_region": regiones_map.get(region_id),
                    "p_ciudad": form.cleaned_data["ciudad"],
                    "p_comuna": form.cleaned_data["comuna"],
                    "p_direccion": form.cleaned_data["direccion"],
                    "p_telefono": form.cleaned_data["telefono"],
                    "p_email": form.cleaned_data["email"],
                    "p_estado": form.cleaned_data["estado"],
                    "p_plan": form.cleaned_data["plan"],
                    "p_owner_email": form.cleaned_data["owner_email"],
                    "p_seller_email": seller_email,
                    "p_zona": form.cleaned_data["zona"],
                }

                # Fuerza zona si el rol requiere restriccion.
                if requiere_restriccion_zona(roles):
                    if not zona_sesion:
                        form.add_error("zona", "No tienes una zona asignada.")
                        return render(request, "empresas/crear.html", {"form": form})
                    datos_empresa["p_zona"] = zona_sesion
                    aplicar_zona_formulario(form, zona_sesion)

                datos_duenio = {
                    "p_owner_rut": form.cleaned_data["owner_rut"],
                    "p_owner_primer_nombre": form.cleaned_data["owner_primer_nombre"],
                    "p_owner_segundo_nombre": form.cleaned_data["owner_segundo_nombre"],
                    "p_owner_apellido_paterno": form.cleaned_data["owner_apellido_paterno"],
                    "p_owner_apellido_materno": form.cleaned_data["owner_apellido_materno"],
                    "p_owner_email": form.cleaned_data["owner_email"],
                    "p_owner_telefono": form.cleaned_data["owner_telefono"],
                }

                if _requiere_autorizacion(roles):
                    crear_solicitud_empresa_admin(
                        {
                            "p_request_type": "company",
                            "p_status": "pendiente",
                            "p_metadata": {
                                **datos_empresa,
                                **datos_duenio,
                                "seller_email": seller_email,
                                "solicitado_por": usuario_id,
                                "roles_solicitante": roles,
                            },
                            "p_submitted_by": usuario_id,
                        }
                    )
                    # Registra auditoria de solicitud creada.
                    registrar_evento_auditoria(
                        usuario,
                        "empresa_solicitud_creada",
                        "requests",
                        None,
                        "media",
                        {"rut": form.cleaned_data["rut"], "owner_email": form.cleaned_data["owner_email"]},
                    )
                    request.session["empresa_mensaje"] = (
                        "Solicitud enviada para autorizacion. Se notificara cuando sea aprobada."
                    )
                    return redirect("empresas_creado")

                # Invita al duenio para crear su contrasena en Supabase Auth.
                nombre_duenio = f"{form.cleaned_data['owner_primer_nombre']} {form.cleaned_data['owner_segundo_nombre']} {form.cleaned_data['owner_apellido_paterno']} {form.cleaned_data['owner_apellido_materno']}".strip()
                usuario_auth, enlace_invitacion = invitar_usuario_auth(
                    form.cleaned_data["owner_email"],
                    {
                        "rut": form.cleaned_data["owner_rut"],
                        "full_name": nombre_duenio,
                        "role": ROL_OWNER_CLIENTE,
                        "roles": [ROL_OWNER_CLIENTE],
                        "tipo_usuario": "propietario_cliente",
                    },
                )

                if enlace_invitacion:
                    request.session["empresa_invite_link"] = enlace_invitacion
                    request.session["empresa_invite_email"] = form.cleaned_data["owner_email"]

                resultado = crear_empresa_con_owner_admin(
                    {
                        **datos_empresa,
                        **datos_duenio,
                        "p_owner_auth_id": usuario_auth.id,
                                                                        "p_owner_tipo_usuario": "propietario_cliente",
                        "p_owner_rol": ROL_OWNER_CLIENTE,
                    }
                )

                # Registra auditoria de empresa creada.
                registrar_evento_auditoria(
                    usuario,
                    "empresa_creada",
                    "clientes",
                    str(resultado.get("empresa_id")) if isinstance(resultado, dict) else None,
                    "media",
                    {"rut": form.cleaned_data["rut"], "owner_email": form.cleaned_data["owner_email"]},
                )

                request.session["empresa_mensaje"] = "Empresa creada correctamente."
                return redirect("empresas_creado")
            except Exception as exc:
                logger.warning("Error al crear empresa: %s", exc)
                # Mapea errores conocidos de la RPC para mostrarlos en el campo correcto.
                mensaje_error = str(exc)
                if "correo del duenio ya esta registrado" in mensaje_error:
                    form.add_error("owner_email", "El correo del dueño ya está registrado.")
                elif "RUT del duenio ya esta registrado" in mensaje_error:
                    form.add_error("owner_rut", "El RUT del dueño ya está registrado.")
                elif "telefono del duenio ya esta registrado" in mensaje_error:
                    form.add_error("owner_telefono", "El teléfono del dueño ya está registrado.")
                elif "RUT de empresa ya esta registrado" in mensaje_error:
                    form.add_error("rut", "El RUT de la empresa ya está registrado.")
                else:
                    form.add_error(None, "No se pudo crear la empresa. Revisa los datos.")
    else:
        zona_sesion = obtener_zona_sesion(request.session)
        roles_sesion = request.session.get("roles") or []
        form = EmpresaCrearForm(segmentos=segmentos, regiones=regiones, initial={"zona": zona_sesion} if zona_sesion else None)
        if requiere_restriccion_zona(roles_sesion):
            aplicar_zona_formulario(form, zona_sesion)

    return render(request, "empresas/crear.html", {"form": form})


# Vista final al crear empresa.
@sesion_requerida
@permiso_requerido("empresas")
def empresas_creado_view(request):
    mensaje = request.session.pop("empresa_mensaje", None)
    enlace = request.session.pop("empresa_invite_link", None)
    correo = request.session.pop("empresa_invite_email", None)
    return render(request, "empresas/creado.html", {"mensaje": mensaje, "enlace_invitacion": enlace, "correo_invitado": correo})


# Edita una empresa existente.
@sesion_requerida
@permiso_requerido("empresas")
def empresas_editar_view(request, empresa_id):
    empresa = obtener_empresa_admin(str(empresa_id))
    if not empresa:
        return redirect("empresas_listado")

    # Evita editar empresas fuera de la zona asignada.
    roles_sesion = request.session.get("roles") or []
    if requiere_restriccion_zona(roles_sesion):
        zona_sesion = obtener_zona_sesion(request.session)
        if zona_sesion and empresa.get("zona") and empresa.get("zona") != zona_sesion:
            return render(
                request,
                "cuentas/sin_permisos.html",
                {"permiso": "Editar empresas fuera de tu zona", "roles": roles_sesion},
            )

    # Restringe edicion a roles autorizados.
    if not puede_editar_empresas(roles_sesion):
        return render(
            request,
            "cuentas/sin_permisos.html",
            {"permiso": "Editar empresas", "roles": roles_sesion},
        )

    segmentos = listar_segmentos_admin()
    regiones = listar_regiones_admin()
    regiones_map = {str(r.get("id")): r.get("nombre") for r in regiones}

    if request.method == "POST":
        form = EmpresaEditarForm(request.POST, segmentos=segmentos, regiones=regiones)
        if form.is_valid():
            try:
                region_id = str(form.cleaned_data["region_id"]) if form.cleaned_data["region_id"] else ""
                resultado = actualizar_empresa_admin(
                    {
                        "p_empresa_id": str(empresa_id),
                        "p_rut": form.cleaned_data["rut"],
                        "p_razon_social": form.cleaned_data["razon_social"],
                        "p_nombre_fantasia": form.cleaned_data["nombre_fantasia"],
                        "p_giro": form.cleaned_data["giro"],
                        "p_segmento_id": int(form.cleaned_data["segmento_id"]) if form.cleaned_data["segmento_id"] else None,
                        "p_region_id": int(form.cleaned_data["region_id"]) if form.cleaned_data["region_id"] else None,
                        "p_region": regiones_map.get(region_id),
                        "p_ciudad": form.cleaned_data["ciudad"],
                        "p_comuna": form.cleaned_data["comuna"],
                        "p_direccion": form.cleaned_data["direccion"],
                        "p_telefono": form.cleaned_data["telefono"],
                        "p_email": form.cleaned_data["email"],
                        "p_estado": form.cleaned_data["estado"],
                        "p_plan": form.cleaned_data["plan"],
                        "p_owner_email": form.cleaned_data["owner_email"],
                        "p_zona": form.cleaned_data["zona"],
                    }
                )
                # Registra auditoria de actualizacion de empresa.
                registrar_evento_auditoria(
                    request.session.get("usuario") or {},
                    "empresa_actualizada",
                    "clientes",
                    str(empresa_id),
                    "media",
                    {"rut": form.cleaned_data["rut"], "plan": form.cleaned_data["plan"], "estado": form.cleaned_data["estado"]},
                )
                return redirect("empresas_listado")
            except Exception as exc:
                logger.warning("Error al editar empresa: %s", exc)
                form.add_error(None, "No se pudo actualizar la empresa.")
    else:
        form = EmpresaEditarForm(
            segmentos=segmentos,
            regiones=regiones,
            initial={
                "rut": empresa.get("rut"),
                "razon_social": empresa.get("razon_social"),
                "nombre_fantasia": empresa.get("nombre_fantasia"),
                "giro": empresa.get("giro"),
                "segmento_id": empresa.get("segmento_id"),
                "region_id": empresa.get("region_id"),
                "ciudad": empresa.get("ciudad"),
                "comuna": empresa.get("comuna"),
                "direccion": empresa.get("direccion"),
                "telefono": (empresa.get("telefono") or "").replace("+56 ", ""),
                "email": empresa.get("email"),
                "estado": empresa.get("estado"),
                "plan": empresa.get("plan"),
                "owner_email": empresa.get("owner_email"),
                "zona": empresa.get("zona") or "",
                "company_code": empresa.get("company_code"),
            }
        )
        if requiere_restriccion_zona(roles_sesion):
            aplicar_zona_formulario(form, empresa.get("zona"))

    return render(
        request,
        "empresas/editar.html",
        {
            "form": form,
            "empresa": empresa,
        },
    )


# Elimina una empresa y sus datos asociados.
@sesion_requerida
@permiso_requerido("empresas")
def empresas_eliminar_view(request, empresa_id):
    if request.method != "POST":
        return redirect("empresas_listado")

    roles_sesion = request.session.get("roles") or []
    if not puede_eliminar_empresas(roles_sesion):
        return render(
            request,
            "cuentas/sin_permisos.html",
            {"permiso": "Eliminar empresas", "roles": roles_sesion},
        )

    empresa = obtener_empresa_admin(str(empresa_id))
    if not empresa:
        return redirect("empresas_listado")

    if requiere_restriccion_zona(roles_sesion):
        zona_sesion = obtener_zona_sesion(request.session)
        if zona_sesion and empresa.get("zona") and empresa.get("zona") != zona_sesion:
            return render(
                request,
                "cuentas/sin_permisos.html",
                {"permiso": "Eliminar empresas fuera de tu zona", "roles": roles_sesion},
            )

    try:
        resultado = eliminar_empresa_admin(str(empresa_id))
        registrar_evento_auditoria(
            request.session.get("usuario") or {},
            "empresa_eliminada",
            "clientes",
            str(empresa_id),
            "alta",
            {"rut": empresa.get("rut"), "email": empresa.get("email")},
        )
        request.session["empresa_mensaje"] = "Empresa eliminada correctamente."
    except Exception as exc:
        logger.warning("Error al eliminar empresa: %s", exc)
        request.session["empresa_mensaje"] = "No se pudo eliminar la empresa."

    return redirect("empresas_listado")
