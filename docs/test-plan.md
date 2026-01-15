# Test Plan

Scope
- Functional, security, performance, and regression tests.

Test types
- Unit: utility functions and validators.
- Integration: Supabase Auth, Edge Functions, DB.
- E2E: login, role access, CRUD, approvals.
- Performance: state load p95/p99.
- Security: access control, injection, session handling.

Entry criteria
- Requirements defined and approved.
- Environments ready (dev/stage).

Exit criteria
- All critical tests pass.
- No high severity defects open.

Test matrix (sample)
- TC-01 Login valid
- TC-02 Login invalid
- TC-03 Role change updates access
- TC-04 Disable user blocks session
- TC-05 Create company with SII fields
- TC-06 Invite user email sent
- TC-07 Delete user removes Auth access

Evidence
- Screenshots or logs per test.
- CI artifacts for automated runs.
