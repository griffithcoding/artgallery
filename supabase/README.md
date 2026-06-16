# Supabase setup

The public site renders without Supabase (it reads the in-repo data seam). Supabase
is only required for `/admin` (auth) and, later, the CMS modules.

1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → paste and run [`schema.sql`](./schema.sql).
3. Project Settings → API: copy the URL, the `anon` key, and the `service_role` key into
   a local `.env` and into the Vercel project's environment variables:
   ```
   PUBLIC_SUPABASE_URL=...
   PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
4. Authentication → Providers → Email: enable it, and disable "Allow new users to sign up".
5. Authentication → Users → Add user: create the gallery-owner admin (email + password).
6. Visit `/admin` → it redirects to `/admin/login`; sign in with that admin user.

## Roles (who can access what)

Access is gated by a role stored in each user's **`app_metadata.role`** (admin-set
only — users cannot change it, so it's safe to trust). Recognized values:

| Role | Lands on | Can access |
| --- | --- | --- |
| `super_admin` (default if unset) | `/admin` | Gallery-owner CMS. **Not** the Design Studio. |
| `creator` / `contributor` | `/studio` | The **Design Studio** (artist design tool). |

- **Gallery owners (your clients):** create the user, then set their role to
  `super_admin` (or leave unset — it defaults to `super_admin`).
- **Artists:** create the user, then set `app_metadata.role` to `creator` or
  `contributor`. They sign in at the same `/admin/login` and are routed to `/studio`.

Set the role via the Supabase dashboard (Authentication → Users → user → edit
`app_metadata`) or the Admin API, e.g.:

```
supabase.auth.admin.updateUserById(USER_ID, { app_metadata: { role: 'creator' } })
```

The `/studio` route is creator/contributor only; `super_admin` is redirected to
`/admin`. The `/admin` CMS currently requires any authenticated session (role-scoped
CMS — e.g. artists editing only their own works — is a follow-on).
