# ISO/IEC 25010 Checklist

Functional suitability
- [ ] All critical flows documented and implemented
- [ ] Validation on inputs and business rules
- [ ] Edge functions return consistent error codes
Evidence: links to SRS, tests

Performance efficiency
- [ ] State load p95 <= target
- [ ] Caching enabled and validated
- [ ] No blocking UI on background loads
Evidence: performance report

Usability
- [ ] Forms show clear errors
- [ ] Labels and actions are consistent
- [ ] Accessibility basic checks (labels, focus)
Evidence: UX review notes

Reliability
- [ ] No console errors in normal flows
- [ ] Fallback to table when Edge fails
- [ ] Retry/backoff for transient failures
Evidence: test logs

Security
- [ ] RBAC enforced on UI and data
- [ ] TLS enforced, no secrets in client
- [ ] Audit log for critical actions
Evidence: security review

Maintainability
- [ ] Modular JS and clear naming
- [ ] Linting rules applied
- [ ] Test coverage for core logic
Evidence: CI results

Portability
- [ ] Static hosting compatible
- [ ] Works in Chrome/Edge/Firefox
- [ ] No platform specific dependencies
Evidence: browser test matrix
