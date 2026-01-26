import logging

from django.shortcuts import render

from cuentas.decorators import permiso_requerido, sesion_requerida
from auditoria.services import registrar_evento_auditoria
from terminal.forms import TerminalSQLForm
from terminal.services import ejecutar_sql_admin

# Logger para errores de la terminal SQL.
logger = logging.getLogger(__name__)


# Terminal SQL para AexfyOwner y Gerente; ejecuta scripts via RPC segura.
@sesion_requerida
@permiso_requerido("terminal")
def terminal_sql_view(request):
    resultado = None
    resumenes = []
    tablas = []
    mensaje = None

    if request.method == "POST":
        form = TerminalSQLForm(request.POST)
        if form.is_valid():
            sql = form.cleaned_data["sql"]
            try:
                usuario_sesion = request.session.get("usuario") or {}
                resultado = ejecutar_sql_admin(
                    sql,
                    str(usuario_sesion.get("id")) if usuario_sesion.get("id") else None,
                    usuario_sesion.get("email"),
                )
                tipo = resultado.get("tipo")

                # Genera resumenes para la vista.
                if tipo == "batch":
                    for idx, item in enumerate(resultado.get("resultados") or [], start=1):
                        if item.get("tipo") == "select":
                            filas = item.get("rows") or []
                            columnas = list(filas[0].keys()) if filas else []
                            resumenes.append({"indice": idx, "tipo": "select", "total": len(filas)})
                            if columnas:
                                tablas.append(
                                    {"indice": idx, "columnas": columnas, "filas": filas, "total": len(filas)}
                                )
                        else:
                            resumenes.append(
                                {"indice": idx, "tipo": "exec", "total": item.get("rowcount", 0)}
                            )
                elif tipo == "select":
                    filas = resultado.get("rows") or []
                    columnas = list(filas[0].keys()) if filas else []
                    resumenes.append({"indice": 1, "tipo": "select", "total": len(filas)})
                    if columnas:
                        tablas.append({"indice": 1, "columnas": columnas, "filas": filas, "total": len(filas)})
                else:
                    resumenes.append({"indice": 1, "tipo": "exec", "total": resultado.get("rowcount", 0)})

                # Registra auditoria del script (solo preview por seguridad).
                registrar_evento_auditoria(
                    usuario_sesion,
                    "terminal_sql_ejecutado",
                    "terminal_sql",
                    None,
                    "alta",
                    {"preview": (sql or "")[:160], "tipo": tipo},
                )

                mensaje = "Script ejecutado correctamente."
            except Exception as exc:
                logger.warning("Error al ejecutar SQL en terminal: %s", exc)
                mensaje = "No se pudo ejecutar el script."
                resultado = {"error": str(exc)}
    else:
        form = TerminalSQLForm()

    return render(
        request,
        "terminal/sql.html",
        {
            "form": form,
            "mensaje": mensaje,
            "resultado": resultado,
            "resumenes": resumenes,
            "tablas": tablas,
        },
    )
