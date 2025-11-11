# Backend configuration

The Go auth service relies on environment variables for OAuth credentials, cookie settings, and redirect targets. The table below summarises each variable and how it is used.

| Variable                    | Required?                         | Purpose                                                                                                                         | Example                                     |
| --------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `SUPABASE_URL`              | Yes                               | Supabase project URL used by the party sync client.                                                                             | `https://your-supabase-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes                               | Service-role API key for Supabase.                                                                                              | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`   |
| `AUTH_JWT_SECRET`           | Yes                               | Secret used to sign session cookies. Use a long random string.                                                                  | `p7iS3wX4...`                               |
| `AUTH_DB_PATH`              | No (defaults to `data/auth.json`) | File path for the JSON store that keeps linked identities and contact handles.                                                  | `data/auth.json`                            |
| `AUTH_COOKIE_NAME`          | No (defaults to `lfg_session`)    | Overrides the session cookie name if you need a custom value.                                                                   | `fp_session`                                |
| `AUTH_COOKIE_DOMAIN`        | No                                | Cookie domain for production deployments. Leave empty for localhost.                                                            | `.findparty.online`                         |
| `AUTH_COOKIE_SECURE`        | No (defaults to `false`)          | Set to `true` to mark the cookie as `Secure` when serving over HTTPS.                                                           | `true`                                      |
| `FRONTEND_URL`              | Yes                               | Base URL of the SPA used when redirecting back after OAuth flows.                                                               | `https://findparty.online`                  |
| `BACKEND_URL`               | Yes                               | Public URL of the Go service, used for OAuth callbacks.                                                                         | `https://findparty.online`                  |
| `DISCORD_CLIENT_ID`         | Yes                               | Discord OAuth client ID.                                                                                                        | `123456789012345678`                        |
| `DISCORD_CLIENT_SECRET`     | Yes                               | Discord OAuth client secret.                                                                                                    | `abcdef0123456789abcdef0123456789`          |
| `STEAM_WEB_API_KEY`         | Yes                               | Steam Web API key for persona lookups.                                                                                          | `0123456789ABCDEFFEDCBA9876543210`          |
| `TELEGRAM_BOT_TOKEN`        | Yes (for Telegram login)          | Bot token used to verify Telegram login payloads.                                                                               | `123456789:AAAbbbCCCdddEEEfff`              |
| `TELEGRAM_BOT_ID`           | No                                | Optional override for the Telegram bot username shown in the client. If omitted the backend will query `getMe` using the token. | `findparty_bot`                             |

Copy `backend/.env.example` to `.env` (or similar) and adjust the values for your deployment.
