This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

Stack: Next.js (App Router) + Supabase + Vercel.

## Supabase setup

1. Copy `.env.example` to `.env.local` and fill in your project URL and publishable key (Supabase Dashboard → Project Settings → API).
2. Supabase clients live in `src/lib/supabase/`:
   - `client.ts` – for Client Components
   - `server.ts` – for Server Components, Server Actions and Route Handlers
   - `proxy.ts` – session refresh, wired up in `src/proxy.ts`
3. Local development / migrations use the Supabase CLI (`npx supabase ...`), configured in `supabase/`:
   - `npx supabase link --project-ref <ref>` – link to a remote project
   - `npx supabase start` – run a local stack (requires Docker)
   - `npx supabase migration new <name>` / `npx supabase db push`

## Vercel

Import the repo in Vercel (or run `npx vercel`) and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as environment variables.

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
