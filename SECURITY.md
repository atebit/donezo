# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in Donezo, please report it responsibly.

**Do not file a public GitHub issue for security vulnerabilities.**

Contact us at:
- **Email:** _[security contact — update this before going public]_
- **Slack:** _[#security channel — update this before going public]_

Please include:
- A description of the vulnerability and the potential impact.
- Steps to reproduce or a proof-of-concept.
- Any suggested mitigation if you have one.

We aim to acknowledge reports within 2 business days and provide a remediation
timeline within 5 business days.

## Secret-rotation cadence

Secrets are rotated **quarterly** (every 3 months) at a minimum, and immediately
if a secret is suspected to have been compromised.

Managed secrets and their rotation procedure are documented in:
[`docs/runbooks/rotate-secrets.md`](docs/runbooks/rotate-secrets.md)

## Incident response

If you observe suspicious activity, data exposure, or a service outage that may be
security-related, follow the incident response runbook:
[`docs/runbooks/incident-response.md`](docs/runbooks/incident-response.md)

## Responsible disclosure

This project follows a responsible-disclosure model. We ask that researchers:
- Give us reasonable time to patch before public disclosure (90 days standard).
- Avoid accessing, modifying, or deleting data that does not belong to you.
- Not perform denial-of-service testing against production.

We will not take legal action against researchers who act in good faith and follow
these guidelines.

## Scope

| In scope | Out of scope |
|----------|--------------|
| Production app at the primary domain | Marketing pages / static assets only |
| Supabase RLS policy bypasses | Third-party services (Vercel, Supabase, Resend infrastructure) |
| Authentication / session vulnerabilities | Spam or social engineering |
| Server-action input validation gaps | |
