# Plan de pruebas

Alcance
- Pruebas funcionales, seguridad, performance y regresion.

Tipos de prueba
- Unitarias: utilidades y validadores.
- Integracion: Supabase Auth, Edge Functions, DB.
- E2E: login, acceso por rol, CRUD, aprobaciones.
- Performance: carga de estado p95/p99.
- Seguridad: control de acceso, inyeccion, manejo de sesion.

Criterios de entrada
- Requisitos definidos y aprobados.
- Ambientes listos (dev/stage).

Criterios de salida
- Todas las pruebas criticas pasan.
- Sin defectos de severidad alta abiertos.

Matriz de pruebas (ejemplo)
- TC-01 Login valido
- TC-02 Login invalido
- TC-03 Cambio de rol actualiza acceso
- TC-04 Deshabilitar usuario bloquea sesion
- TC-05 Crear empresa con campos SII
- TC-06 Invitacion de usuario enviada
- TC-07 Eliminar usuario quita acceso Auth

Evidencia
- Capturas o logs por prueba.
- Artefactos de CI para ejecuciones automaticas.
