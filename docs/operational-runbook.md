# Operational Runbook

Monitoring
- Check Supabase Auth status, Edge Function logs, and DB health.
- Review audit log for critical actions.

Backups and recovery
- Daily backups with retention >= 30 days.
- Quarterly restore test.

Key rotation
- Rotate service role keys every 90 days.
- Update Supabase secrets and redeploy functions.

Incident response
- Identify impact and scope.
- Disable compromised users.
- Collect logs and evidence.
- Post-incident report with actions.

Operational checks
- Verify GitHub Pages deployment on each release.
- Validate URL allow list for auth redirects.
- Verify Edge Functions permissions.
