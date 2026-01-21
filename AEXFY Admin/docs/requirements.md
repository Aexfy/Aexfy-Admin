# Requisitos (SRS)

Alcance
- Producto: Aexfy Admin.
- Stack: HTML/CSS/JS (sin build), Supabase Auth/DB/Edge Functions.

Requisitos funcionales
FR-01 Autenticacion
- Login con email y contrasena. 👍
- Sesion validada contra Auth, usuarios revocados bloqueados. 👍

FR-02 Roles y acceso
- Roles definen modulos y acciones permitidas. 👍
- Acceso por pagina y por accion. 👍
- Cambio de rol actualiza acceso sin reload manual. 👍

FR-03 Gestion de estado
- Estado en aexfy_admin_state. 👍
- Edge Function admin-state como via principal. 👍
- Fallback a tabla cuando falla Edge. 👍

FR-04 Usuarios
- CRUD de usuarios. 👍
- Invitacion por email para crear contrasena. 👍
- Rol cliente requiere empresa asociada. 👍

FR-05 Staff
- Gestion de staff con asignacion de roles. 👍
- Estado activo/deshabilitado. 👍

FR-06 Empresas
- CRUD con campos SII. 👍
- ID por zona. 👍
- Invitacion de owner como cliente. 👍

FR-07 Auditoria
- Registro de acciones criticas. 👍

Requisitos no funcionales (ISO/IEC 25010)
- Adecuacion funcional: flujos criticos disponibles.
- Rendimiento: p95 <= objetivo definido.
- Usabilidad: UI consistente y mensajes claros.
- Fiabilidad: fallback y manejo de errores.
- Seguridad: RBAC, TLS, secretos fuera del cliente. 👍
- Mantenibilidad: modularidad y naming consistente. 👍
- Portabilidad: hosting estatico. 👍
- Portabilidad: navegadores modernos.

Restricciones
- Sin service role en cliente. 👍
- Acciones admin via Edge Functions. 👍
- UI en espanol y archivos ASCII.

Criterios de aceptacion
- Login -> panel -> logout funciona. 👍
- Usuario deshabilitado no puede acceder. 👍
- Roles cambian acceso y navegacion. 👍
- Estado persiste tras recargar. 👍
