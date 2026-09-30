# Polish verification

Verified locally on 30 September 2026 against a disposable SQLite demo database and the Next.js production build.

| Check | Result |
|---|---|
| Backend suite | 105 tests passed; 8 existing deprecation warnings |
| Frontend lint | Passed |
| Frontend production build | Passed on Next.js 16.3.7 |
| npm audit | Zero vulnerabilities across installed dependencies |
| Responsive web | Dashboard, products, parties, sales, purchases, khata and Munshi at 320, 390, 768 and 1440px, in English and Urdu; no page overflow or uncaught browser errors |
| Browser trade cycle | Purchase 10 × Rs100 → stock 10 / supplier balance −Rs1,000; sale 2 × Rs150 → stock 8 / customer balance Rs300; pay supplier and collect customer payment → both balances zero |
| Reports | Statement PDF downloads and daily-summary clipboard copy succeed |
| Authentication | Demo login loads actual user identity; protected-page refresh preserves the saved session |
| Munshi | Offline answer exposes the read-only tool source; backend tests cover golden questions and guardrails |
| Demo seed | Rebuilds the synthetic 90-day dataset without overselling; invoice and settlement posting uses the current service |

The responsive checks used Chromium with real local API responses, not static mocks. Documentation screenshots show the seeded demo. The browser trade cycle used separate test parties and a test SKU.

Not verified in this milestone: public cloud deployment, hosted PostgreSQL concurrency, live paid model calls, native mobile devices, multi-business isolation, historical-cost accounting or large-volume performance. See [completion gates](COMPLETION-PLAN.md).
