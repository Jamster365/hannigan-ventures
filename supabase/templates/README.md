# Auth email templates

Branded HTML for the Supabase Auth emails. Supabase only lets you edit templates once **custom SMTP** is configured (Authentication → Emails → SMTP Settings); on the built-in sender the defaults are used and they cannot be changed.

| Supabase template | File | Subject |
| --- | --- | --- |
| Magic link or OTP | `magic-link.html` | Your Hannigan Ventures sign-in link |
| Invite user | `invite.html` | You're invited to Hannigan Ventures |

Paste each file into the template's **Source** tab and save.

## Why the links use `token_hash`
The default link only works in the same browser that requested it (PKCE). On iPhone, a link opened from Mail can land in Safari, in Chrome, or outside a home-screen web app, which breaks sign-in. These templates send `token_hash` to `/auth/callback`, which verifies it on the server, so the link works in any browser.

`{{ .RedirectTo }}` is the app's own callback URL (for example `…/auth/callback?next=/` or `…?next=/invite/<token>`), so the link keeps its destination. That URL must be in Authentication → URL Configuration → Redirect URLs, otherwise Supabase substitutes the Site URL and the link breaks.
