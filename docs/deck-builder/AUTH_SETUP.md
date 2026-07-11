# Deck Builder Auth Setup: Google + Discord

A one-time, ~20-minute task **for you** (Claude writes the code in #463; this is the part only you can do). The local builder works without it, so do this whenever you are ready to turn on cloud accounts. Nothing here needs code knowledge.

**Your Supabase project:** `ttyidjyaxnycbpxwngqr` (eu-central-1).

**The one URL you will paste into both providers (the "provider callback"):**

```
https://ttyidjyaxnycbpxwngqr.supabase.co/auth/v1/callback
```

Prerequisites: access to the Supabase dashboard for the project above, a Google account, and a Discord account.

---

## Part A: Create the Google OAuth app (~8 min)

1. Go to https://console.cloud.google.com/ and sign in.
2. Top bar: create a new project (or select an existing one). Name it e.g. `Inkweave`.
3. Left menu: **APIs & Services → OAuth consent screen**.
   - User type: **External**. Create.
   - App name: `Inkweave`. User support email: your email. Developer contact: your email. Save and continue through the scopes and test-users steps (defaults are fine).
   - You can leave it in **Testing** mode for now (add your own Google account under "Test users"); Publish it later when you want anyone to sign in.
4. Left menu: **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Inkweave Web`.
   - **Authorized redirect URIs → Add URI**, paste exactly:
     `https://ttyidjyaxnycbpxwngqr.supabase.co/auth/v1/callback`
   - Create.
5. Copy the **Client ID** and **Client Secret** that pop up. Keep them for Part C.

## Part B: Create the Discord OAuth app (~5 min)

1. Go to https://discord.com/developers/applications and sign in.
2. **New Application**, name it `Inkweave`, Create.
3. Left menu: **OAuth2**.
   - Under **Redirects → Add Redirect**, paste the same URL:
     `https://ttyidjyaxnycbpxwngqr.supabase.co/auth/v1/callback` then **Save Changes**.
   - Copy the **Client ID** (shown on the OAuth2 page).
   - For the **Client Secret**: click **Reset Secret** (or Copy) and keep it. Save both for Part C.

## Part C: Enable the providers in Supabase (~4 min)

1. Open https://supabase.com/dashboard/project/ttyidjyaxnycbpxwngqr → **Authentication → Providers** (sometimes labeled "Sign In / Providers").
2. **Google**: toggle **Enabled**, paste the Google Client ID + Client Secret from Part A, Save.
3. **Discord**: toggle **Enabled**, paste the Discord Client ID + Client Secret from Part B, Save.

## Part D: URL configuration in Supabase (~2 min)

1. **Authentication → URL Configuration**.
2. **Site URL**: your production URL (e.g. `https://inkweave.vercel.app` or your domain). If prod is not up yet, use `http://localhost:5173`.
3. **Redirect URLs**: add both of these (this is the *app's* callback route, which is different from the provider callback above):
   - `http://localhost:5173/auth/callback`
   - `https://<your-prod-domain>/auth/callback`
4. Save.

## Part E: Verify (after the #463 auth code is merged)

- Run the app, click **Sign in**, choose Google or Discord, complete the consent, and you should land back on `/decks` signed in.
- If sign-in fails with a redirect error: the redirect URI in the provider (Parts A/B) must EXACTLY match `https://ttyidjyaxnycbpxwngqr.supabase.co/auth/v1/callback` (https, no trailing slash).

## Notes and gotchas

- **Two different callback URLs, both required.** The *provider* redirect is Supabase's `/auth/v1/callback` (Parts A/B/C). The *app* redirect is your site's `/auth/callback` (Part D). Do not mix them up.
- Google **Testing** mode restricts sign-in to your listed test users; Publish the consent screen for public sign-in.
- **Secrets** go only into the Supabase dashboard. Never commit them. The web client only ever ships the public anon key.
- Want zero setup to start? Supabase **anonymous sign-in** or **email magic-link** needs no OAuth apps and can be enabled in the same Providers page; we can layer Google/Discord on later.
