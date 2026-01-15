# Protocolos de seguridad (ISO/IEC 27001)

Objetivos de seguridad
- Proteger confidencialidad, integridad y disponibilidad.
- Aplicar minimo privilegio y trazabilidad.

Gestion de identidad y acceso
- MFA requerido para cuentas admin.
- RBAC con roles en metadata Auth y state. 👍
- Revision periodica de accesos (mensual).
- Revocacion inmediata al cambiar estado o eliminar. 👍

Cifrado
- TLS 1.2+ para todo el trafico. 👍
- Secrets en Supabase Secrets y nunca en el cliente. 👍
- Backups cifrados en reposo.

Gestion de sesion
- Validar sesion con Auth al cargar. 👍
- Re-sincronizar sesion con state despues de guardar. 👍
- Cerrar sesion al eliminar o deshabilitar. 👍

Logging y auditoria
- Log de create/update/delete para usuarios y empresas. 👍
- Audit log en meta.auditLog con timestamps. 👍
- Politica de retencion centralizada (min 180 dias).

SDLC seguro
- Code review con checklist de seguridad.
- Escaneo de dependencias para JS.
- SAST en CI para JS y Edge Functions.

Respuesta a incidentes
- Triage en 24h.
- Contencion, erradicacion y recuperacion documentadas.
- Postmortem con acciones correctivas.

Manejo de datos
- Clasificacion: publico, interno, confidencial.
- Sin PII en logs del cliente.
- Acceso a datos solo por roles autorizados.

Mapa de controles (resumen)
- A.5 Politicas de seguridad de la informacion: definidas en security-27001.md
- A.6 Organizacion de seguridad: roles y responsabilidades
- A.8 Gestion de activos: clasificacion y ownership
- A.9 Control de acceso: RBAC, MFA, revisiones
- A.12 Seguridad de operaciones: logging, backup, monitoreo
- A.16 Gestion de incidentes: respuesta documentada
- A.18 Cumplimiento: evidencia y trazabilidad
