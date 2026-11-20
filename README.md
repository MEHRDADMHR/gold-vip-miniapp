# GOLDEN CLUB

A Persian, RTL, black-and-gold Telegram Mini App storefront built with Next.js.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local`.
3. Set the Telegram and Supabase server environment variables.
4. Run `npm install` and `npm run dev`.

## Database setup (Supabase)

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Vercel Project Settings > Environment Variables, add:
   - `SUPABASE_URL`: Project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: service_role key (server only)
   - `TELEGRAM_BOT_TOKEN`: BotFather token (server only)
   - `SESSION_SECRET`: a random secret of at least 32 characters
4. Redeploy after setting environment variables.

Never expose the service-role key or bot token in browser code, and never prefix them with `NEXT_PUBLIC_`.

## Current implementation

- Responsive black-and-gold RTL landing page.
- Four membership plan records seeded in the database.
- Telegram Mini App SDK bootstrap.
- Server-side Telegram Web App initData signature and freshness validation.
- Verified Telegram users are upserted into Supabase.
- Server issues an HttpOnly signed session cookie and checks active subscription status.

## Still required before production

- Payment provider that explicitly permits the business and content category in the operating jurisdiction; no payment activation is implemented yet.
- Admin dashboard and role-protected management actions.
- Secure video storage/streaming with short-lived signed playback URLs and server-enforced 30-second previews.
- Real age assurance, privacy policy, content rights review, moderation and deletion workflows.
- Security review, rate limiting, monitoring and backup policy.

The authentication route persists verified Telegram users and reads membership status. It does not create subscriptions or accept payments.
