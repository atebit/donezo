# Auth email templates

This folder will hold branded HTML for Supabase Auth emails (confirm, reset, magic link, invite, email change).

In epic 03, we ship the auth flows working with Supabase's **default** templates. Branded HTML lands in **epic 13** (notifications/email) alongside Resend + React Email.

When epic 13 lands:
1. Author React Email components per template type.
2. Render to HTML at build time and copy into Supabase dashboard → Authentication → Email Templates.
3. Commit the rendered HTML here for diffing across versions.
