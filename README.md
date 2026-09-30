# Fleetly

Multi-tenant fleet management & ERP for car rental agencies. Next.js (App Router) + Supabase + Vercel.
Product brief and coding conventions: [CLAUDE.md](CLAUDE.md).

## Project layout

- `src/domain/` – pure business logic (roles, permissions, slug rules)
- `src/server/` – data access and use cases (server-only)
- `src/app/` – routes and Server Actions: `(auth)` login/signup, `onboarding`, `(app)` protected shell
- `src/proxy.ts` – session refresh + auth redirects
- `supabase/migrations/` – schema, RLS policies, RPCs
- `supabase/tests/` – RLS tests on in-memory Postgres (`npm run test:db`, no Docker needed)

## Supabase setup

1. Copy `.env.example` to `.env.local` and fill in your project URL and publishable key (Supabase Dashboard → Project Settings → API).
2. Apply the migrations to your project:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. In Supabase Dashboard → Authentication → URL Configuration, set **Site URL** to your production URL and add
   `http://localhost:3000/**` and `https://<your-vercel-domain>/**` to **Redirect URLs** (email confirmation lands on `/auth/confirm`).
4. After any schema change, update `src/lib/supabase/database.types.ts` (or run `npx supabase gen types typescript --linked`).

## Vercel

Import the repo in Vercel (or run `npx vercel`) and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as environment variables, then redeploy.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
