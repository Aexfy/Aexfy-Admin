import logging

from django.shortcuts import render

from cuentas.decorators import permiso_requerido, sesion_requerida
from reportes.services import obtener_resumen_empresas, obtener_resumen_usuarios

# Logger para errores del modulo de reportes.
logger = logging.getLogger(__name__)


# Vista principal de reportes con resumenes simples.
@sesion_requerida
@permiso_requerido("reportes")
def reportes_listado_view(request):
    resumen_empresas = {"zonas": [], "estados": [], "planes": []}
    resumen_usuarios = {"zonas": [], "estados": [], "tipos": []}

    try:
        resumen_empresas = obtener_resumen_empresas()
    except Exception as exc:
        logger.warning("Error al obtener resumen de empresas: %s", exc)

    try:
        resumen_usuarios = obtener_resumen_usuarios()
    except Exception as exc:
        logger.warning("Error al obtener resumen de usuarios: %s", exc)

    # Agrega porcentaje para barras simples en UI.
    def _con_porcentaje(items):
        max_total = max([item.get("total", 0) for item in items], default=0)
        salida = []
        for item in items:
            total = item.get("total", 0) or 0
            pct = int((total / max_total) * 100) if max_total else 0
            salida.append({**item, "pct": pct})
        return salida

    resumen_empresas = {
        "zonas": _con_porcentaje(resumen_empresas.get("zonas", [])),
        "estados": _con_porcentaje(resumen_empresas.get("estados", [])),
        "planes": _con_porcentaje(resumen_empresas.get("planes", [])),
    }
    resumen_usuarios = {
        "zonas": _con_porcentaje(resumen_usuarios.get("zonas", [])),
        "estados": _con_porcentaje(resumen_usuarios.get("estados", [])),
        "tipos": _con_porcentaje(resumen_usuarios.get("tipos", [])),
    }

    return render(
        request,
        "reportes/listado.html",
        {
            "resumen_empresas": resumen_empresas,
            "resumen_usuarios": resumen_usuarios,
        },
    )
