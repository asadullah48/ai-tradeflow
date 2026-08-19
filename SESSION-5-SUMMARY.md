# Session 5 — Post-v1 Roadmap: v1.1 Expo Mobile App

**Source:** `SPEC-TRADEFLOW.md` §12 Post-v1 Roadmap, item v1.1 ("Expo
mobile app, EAS build"). First item worked per the user's explicit
instruction (2026-08-19) to continue the post-v1 roadmap session-by-session
so a context/session limit doesn't lose progress - each roadmap item gets
its own session and summary, same discipline as Sessions 1-4.

## What was built

`mobile/` - an Expo Router (SDK 57) app, TypeScript, sharing the exact
same backend and auth model as `frontend/`:

- **Login** (`app/login.tsx`) - phone/password against `/auth/login`.
- **Dashboard** (`app/(tabs)/dashboard.tsx`) - today's sales,
  receivables/payables, stock alerts, top udhaar exposure; pull-to-refresh.
- **Khata** (`app/(tabs)/khata/index.tsx` + `[partyId].tsx`) - every
  party's balance, tap in for the full ledger and aging buckets.
- **Munshi AI** (`app/(tabs)/munshi.tsx`) - the same chat-with-your-data
  agent as the web app, with tool-citation footers and blocked-answer
  styling.
- `lib/store.ts` / `lib/api.ts` - deliberately mirror
  `frontend/lib/store.ts` / `frontend/lib/api.ts` almost line for line
  (same `ApiError` shape, same 401-clears-auth behavior), swapping
  `localStorage` for `AsyncStorage` and adding a `hydrated` flag so the
  app never flashes the login screen while a real token is still loading
  from storage.
- `eas.json` - development/preview/production build profiles.

## Scope decision: smaller than the web app, on purpose

This is NOT a mobile port of every web screen. Parties/Products/Purchases/
Sales CRUD stay web-only for v1.1 - multi-line-item order entry is
genuinely worse on a phone keyboard than the web app's forms, and the
mobile use case that actually matters ("check the numbers, chase udhaar,
ask Munshi something, while you're standing in the shop") doesn't need
it. Documented explicitly in `mobile/README.md` rather than silently
omitted, with v1.2 (per-munshi permissions) as the natural place to
revisit if field data entry turns out to matter.

## Verification (no physical device or simulator available)

- `npx tsc --noEmit` - clean, zero errors.
- `npx expo start --web` - dev server started, served the app shell
  (`<title>AI TradeFlow</title>`, HTTP 200).
- Directly fetched the compiled Metro bundle
  (`/node_modules/expo-router/entry.bundle?platform=web...`) to force a
  full compile rather than trust an idle dev server: **879 modules
  bundled successfully, 4MB, zero errors**, and grepped for the actual
  screen strings ("AI TradeFlow", "Munshi AI", "Dashboard", "Khata") to
  confirm real screen code made it into the bundle, not just the shell.
- **Not verified**: actual behavior on an Android/iOS device or
  simulator, and EAS cloud builds (needs an authenticated Expo account -
  not available in this environment). `eas.json` and `mobile/README.md`
  document the exact commands to finish this yourself.

## A design note: why this mirrors the web app's api.ts/store.ts so closely

Munshi AI, the constitution, and every service-layer invariant already
live once, correctly, in the backend - the mobile app's entire job is to
be a thin, honest client of the same API the web app calls. Keeping
`lib/api.ts` and `lib/store.ts` structurally identical to their web
counterparts (same error handling, same auth-clearing behavior) means a
bug fix or endpoint change on one side has an obvious, mechanical
counterpart on the other - there's no separate mobile-specific business
logic to drift out of sync.
