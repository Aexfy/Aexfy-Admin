# Requirements (SRS)

Scope
- Product: Aexfy Admin portal.
- Stack: HTML/CSS/JS (no build), Supabase Auth/DB/Edge Functions.

Functional requirements
FR-01 Auth
- Users can login with email and password.
- Sessions are validated against Auth and revoked users are blocked.

FR-02 Roles and access
- Roles define allowed modules and actions.
- Access is enforced per page and per action.
- Changing roles updates access without manual reload.

FR-03 State management
- State is stored in aexfy_admin_state.
- Edge function admin-state is primary read/write path.
- Fallback to table when Edge fails.

FR-04 Users
- Create, edit, disable, delete users.
- Invite flow sends password creation email.
- Client role requires company association.

FR-05 Staff
- Staff management with role assignments.
- Status can be set to active or disabled.

FR-06 Companies
- Company CRUD with SII fields.
- Company IDs prefixed by zone.
- Owner invite as client.

FR-07 Audit
- Critical actions are logged (create, update, delete).

Non-functional requirements (ISO/IEC 25010)
- Functional suitability: 100% of critical flows available.
- Performance: p95 < 1.5s for state load on broadband.
- Usability: consistent UI, clear errors, accessible forms.
- Reliability: no console errors in normal flows.
- Security: RBAC, encrypted transport, least privilege.
- Maintainability: modular JS, clear naming, tests.
- Portability: works in modern browsers, static hosting.

Constraints
- No service_role key in client.
- All admin operations via Edge Functions.
- UI in Spanish, ASCII text only in files.

Acceptance criteria
- Login -> panel -> logout works.
- Disabled user is blocked and session ends.
- Role changes update page access in real time.
- State persists across reloads.
