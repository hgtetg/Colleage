# Campus Hub

Campus Hub is a production-ready student course workspace built with React, Vinext, and Cloudflare Workers.

## What works

- Secure email/password account creation and sign-in
- Salted PBKDF2 password hashing, hashed sessions, same-origin checks, and sign-in rate limits
- Course-code enrollment with student and representative permissions
- Subjects, lectures, completion tracking, materials, schedules, and calendar export
- Study-room booking and private course community posts, reactions, and replies
- Representative roster, CSV export, course access-code controls, and audit records
- Student work, scholarship, and volunteer applications with status tracking
- Editable profiles, private R2 profile-photo storage, settings, and notifications
- Stripe Checkout donation flow and verified payment webhook
- Persistent data in Cloudflare D1 and private files in Cloudflare R2

## Local development

```bash
pnpm install
pnpm run db:migrate:local
pnpm run dev
```

Student course code: `DSA2-K7Q1`

Representative course code: `REP-SE2-4MK`

## Cloudflare deployment

```bash
pnpm run db:migrate:remote
pnpm run deploy
```

The checked-in Cloudflare configuration binds:

- D1 database `campus-hub-db` as `DB`
- R2 bucket `campus-hub-files` as `FILES`

To accept real donations, add the following encrypted Worker secrets:

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
```

Then register `/api/donations/webhook` as a Stripe webhook endpoint for the `checkout.session.completed` event. Never commit secret values to Git.

## Continuous deployment

Connect this repository in Cloudflare Workers Builds. Use `pnpm run deploy` as the deploy command and `main` as the production branch. D1 migrations should be reviewed and applied before an incompatible schema release.

Cloudflare deployment trigger.
