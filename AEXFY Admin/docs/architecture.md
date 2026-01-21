# Arquitectura

Resumen
- Frontend: HTML/CSS/JS estatico en GitHub Pages.
- Backend: Supabase Auth, Postgres, Edge Functions.
- Seguridad: RBAC, control de sesion, auditoria, TLS.

Vista de componentes (logica)

[Navegador]
  |  HTML/JS/CSS
  v
[Hosting estatico]
  |  JS SDK
  v
[Supabase Auth] <-> [Postgres]
  ^                 ^
  |                 |
  +-> [Edge Functions]
      - admin-state
      - admin-create-user
      - admin-user-action

Almacenamiento principal
- public.aexfy_admin_state: estado central (companies, users, meta).
- auth.users: autenticacion y metadata de usuario.

Flujos clave
1) Login
- Navegador -> Supabase Auth signInWithPassword
- Sesion en el navegador
- Claims usados para acceso y estado

2) Carga de estado
- Navegador -> Edge Function admin-state (Bearer token) 👍
- Fallback a tabla aexfy_admin_state 👍
- Cache en sessionStorage 👍

3) Crear usuario
- Navegador -> admin-create-user 👍
- Function usa service role key
- Escribe en auth.users y retorna invitacion 👍
- UI persiste en aexfy_admin_state 👍

4) Eliminar o deshabilitar usuario
- Navegador -> admin-user-action 👍
- Function elimina o banea en Auth 👍
- UI actualiza aexfy_admin_state 👍
- Sesion se bloquea si estado != activo 👍

Despliegue
- Frontend: GitHub Pages (prod)
- Supabase: proyecto con Auth, DB, Edge Functions
- Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INVITE_REDIRECT_URL

Escalabilidad
- Front-end sin estado
- Edge Functions para operaciones privilegiadas 👍
- Postgres como fuente de verdad
- Cache para lecturas frecuentes 👍

Mantenibilidad
- Modulos JS por feature 👍
- Estado y utilidades centralizadas
- Separacion UI, data y auth 👍

Seguridad por diseno
- Service role fuera del cliente 👍
- Acciones admin via Edge Functions 👍
- Control de acceso por rol 👍
- Auditoria de acciones criticas 👍
