# GOLDEN CLUB

A Persian, RTL, black-and-gold membership storefront scaffold built with Next.js.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local`.
3. Set `TELEGRAM_BOT_TOKEN` from BotFather.
4. Run `npm install` and `npm run dev`.

## Current implementation

- Responsive black-and-gold RTL landing page.
- Four membership plan placeholders (monthly, quarterly, six-month, annual).
- Telegram Mini App SDK bootstrap.
- Server-side Telegram Web App initData signature and age validation.
- No public/free video catalog; preview area is a visual placeholder.

## Required before production

- Database and persistent Telegram user records.
- Subscription lifecycle and admin dashboard.
- Adult-content-compliant payment provider for the business jurisdiction.
- Secure video storage/streaming with short-lived signed playback URLs and server-enforced 30-second previews.
- Real age assurance, privacy policy, content rights review, moderation and deletion workflows.
- Configure secrets only in the deployment environment; never commit bot tokens.

The Telegram endpoint currently verifies identity but does not create a persistent account or grant access. Payment, database, video delivery, and admin operations are intentionally not represented as complete.
