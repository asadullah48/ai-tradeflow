# AI TradeFlow — Mobile (v1.1)

An Expo Router mobile companion to the web app - the on-the-go slice of
TradeFlow: check today's numbers, chase udhaar, and ask Munshi AI,
straight from a phone. Full data entry (parties/products/orders CRUD)
stays on the web app for now - see "Scope" below.

## Screens

| Screen | Route | What it does |
|---|---|---|
| Login | `/login` | Phone + password against the same backend as the web app |
| Dashboard | `/(tabs)/dashboard` | Today's sales, receivables/payables, stock alerts, top udhaar exposure - pull to refresh |
| Khata | `/(tabs)/khata` -> `/(tabs)/khata/[partyId]` | Every party's balance at a glance, tap in for the full ledger + aging buckets |
| Munshi AI | `/(tabs)/munshi` | The same chat-with-your-data agent as the web app, with tool-citation footers |

## Running it

```bash
cd mobile
npm install
cp .env.example .env      # edit EXPO_PUBLIC_API_URL - see note below
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iOS), or
press `w` for a web preview, `a`/`i` for an emulator/simulator.

**`EXPO_PUBLIC_API_URL` depends on where the backend actually runs relative
to your device:**

| Running from | Use |
|---|---|
| Web preview / same machine | `http://localhost:8000` |
| Android emulator | `http://10.0.2.2:8000` (emulator's alias for host localhost) |
| iOS simulator | `http://localhost:8000` (works directly) |
| Physical device, same Wi-Fi | `http://<your-machine's-LAN-IP>:8000` |
| Any device, backend deployed | your real backend URL (e.g. Railway) |

## Building with EAS

```bash
npm install -g eas-cli
eas login                      # your own Expo account
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

`eas.json` is already configured with `development`/`preview`/`production`
profiles. **Not run as part of this build** - it needs an authenticated
Expo account, which wasn't available in the environment this was built
in. Fill in the real `EXPO_PUBLIC_API_URL` for your deployed backend in
`eas.json` before building `preview`/`production`.

## Scope (v1.1 - deliberately smaller than the web app)

This mobile app covers the "check on things while you're out" use case,
not full data entry - a trader adding stock or recording a sale is much
better served by the web app's multi-line-item order forms than a phone
keyboard. What's here: viewing the dashboard, checking any party's khata,
and asking Munshi AI. Order entry, party/product management, and PDF
export are intentionally web-only for v1.1 - a natural v1.2 extension if
field data entry turns out to matter more than expected.

## Architecture notes

- Same auth token, same backend, same `/agent/ask` endpoint as the web
  app - this is a second client, not a second backend.
- `lib/store.ts` mirrors `frontend/lib/store.ts`'s zustand pattern, but
  persists to `AsyncStorage` instead of `localStorage`, with a `hydrated`
  flag so the app never flashes the login screen while AsyncStorage is
  still loading a token that does exist.
- `lib/api.ts` mirrors `frontend/lib/api.ts` almost line for line - same
  `ApiError` shape, same 401-clears-auth behavior.
