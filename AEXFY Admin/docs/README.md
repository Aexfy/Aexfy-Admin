# Documentacion ISO para Aexfy Admin

Proposito
- Proveer plantillas tecnicas y procedimentales alineadas a ISO/IEC 25010, ISO/IEC 27001 e ISO 9001.
- Adaptado para app estatica HTML/JS con Supabase (Auth, Edge Functions, Postgres).

Alcance
- Producto: Aexfy Admin (front-end estatico + backend Supabase).
- Ambientes: dev, staging, prod.

Controles ya aplicados en el codigo
- RBAC y control de acceso por pagina 👍
- Acciones admin via Edge Functions 👍
- Auditoria de acciones criticas 👍
- Bloqueo de sesion al deshabilitar o eliminar usuarios 👍

Documentos
- requirements.md: requisitos funcionales y no funcionales.
- architecture.md: componentes, flujos, despliegue, escalabilidad.
- data-model.md: estructura de aexfy_admin_state y metadata Auth.
- iso25010-checklist.md: checklist de calidad y evidencia.
- security-27001.md: controles de seguridad y procedimientos.
- soa-27001.md: Statement of Applicability (SoA).
- iso9001-process.md: procesos, PDCA, control de cambios.
- test-plan.md: estrategia y tipos de prueba.
- traceability-matrix.md: matriz de trazabilidad.
- operational-runbook.md: operaciones, monitoreo, backup y recovery.
- change-log.md: registro de cambios.
- release-notes.md: notas de version por release.
- nonconformity-log.md: registro de no conformidades.
- quality-review.md: revision trimestral de calidad.
- risk-register.md: registro de riesgos.
- required-docs.md: lista minima de documentacion.

Responsable
- Rol: Solution Architect / Security Lead
- Frecuencia de actualizacion: por release o cambio mayor.
