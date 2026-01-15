# Architecture

Overview
- Frontend: static HTML/CSS/JS hosted on GitHub Pages.
- Backend: Supabase Auth, Postgres, Edge Functions.
- Security: RBAC, session checks, audit logging, TLS.

Component view (logical)

[Browser]
  |  HTML/JS/CSS
  v
[Static Hosting]
  |  JS SDK
  v
[Supabase Auth] <-> [Postgres]
  ^                 ^
  |                 |
  +-> [Edge Functions]
      - admin-state
      - admin-create-user
      - admin-user-action

Key data stores
- public.aexfy_admin_state: central state (companies, users, meta).
- auth.users: authentication and user metadata.

Key data flows
1) Login
- Browser -> Supabase Auth signInWithPassword
- Session stored in browser
- Auth claims used to load state and set access

2) Load state
- Browser -> Edge Function admin-state (Bearer token)
- Fallback to aexfy_admin_state table
- Cache in sessionStorage

3) Create user
- Browser -> admin-create-user
- Function uses service role key
- Writes to auth.users and returns invite link
- UI persists user in aexfy_admin_state

4) Delete or disable user
- Browser -> admin-user-action
- Function deletes or bans auth user
- UI removes user from aexfy_admin_state
- Session sync revokes access if status is not active

Deployment
- Frontend: GitHub Pages (prod)
- Supabase: Project with Auth, DB, Edge Functions
- Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INVITE_REDIRECT_URL

Scalability
- Stateless front-end
- Edge Functions for privileged actions
- Postgres as system of record
- Optional caching for read-heavy pages

Maintainability
- Modular JS files by feature
- Central core state and utilities
- Clear separation of UI, data, and auth

Security by design
- No service role key in client
- All admin actions via Edge Functions
- Role-based access control and page gating
- Audit log for critical actions
