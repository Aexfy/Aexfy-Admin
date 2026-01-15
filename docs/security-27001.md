# Security Protocols (ISO/IEC 27001)

Security objectives
- Protect confidentiality, integrity, and availability.
- Enforce least privilege and traceability.

Identity and access management
- MFA required for admin accounts.
- RBAC with roles stored in Auth metadata and state.
- Periodic access review (monthly).
- Immediate revocation on status change or removal.

Encryption
- TLS 1.2+ for all traffic.
- Secrets stored in Supabase secrets and never in client.
- Backups encrypted at rest.

Session management
- Validate session with Auth on load.
- Re-sync session with state after saves.
- Sign out on removal or disable.

Logging and audit
- Log create/update/delete for users and companies.
- Store audit log in meta.auditLog with timestamps.
- Centralized log retention policy (min 180 days).

Secure SDLC
- Code review with security checklist.
- Dependency scanning for JS libraries.
- SAST on CI for JS and Edge functions.

Incident response
- Triage within 24h.
- Containment, eradication, recovery steps documented.
- Post-incident review with corrective actions.

Data handling
- Data classification: public, internal, confidential.
- No PII in client logs.
- Data access only via authorized roles.

Control mapping (summary)
- A.5 Information security policies: defined in security-27001.md
- A.6 Organization of information security: roles and responsibilities
- A.8 Asset management: data classification and ownership
- A.9 Access control: RBAC, MFA, reviews
- A.12 Operations security: logging, backup, monitoring
- A.16 Incident management: response process
- A.18 Compliance: audit evidence and traceability
