# AI TradeFlow: completion criteria

## Current milestone: polished local MVP

The web workspace supports an end-to-end demo: receive stock, sell on credit or cash, inspect the party khata, record payment, download a statement, and ask Munshi a grounded question. The dashboard connects receivables and stock alerts directly to the next action. English and Urdu interfaces are available on desktop and mobile web.

Order posting with `ledger_method` writes the invoice, stock movement and ledger entries in one database transaction. Cash/bank/wallet settlement creates an invoice and an offsetting payment; credit creates the outstanding balance. Omitting `ledger_method` preserves legacy clients that post ledger entries separately. This compatibility path is not a guarantee of ledger completeness for old clients.

## Gates before accepting real customer data

| Area | Remaining work | Acceptance evidence |
|---|---|---|
| Business isolation | Enforce tenant scope in every query, export and agent tool; restrict registration and role assignment | Two-business tests prove no cross-business reads or writes |
| Accounting precision | Decimal database money columns and immutable historical cost snapshots | Changing today's cost cannot alter yesterday's profit |
| Posting reliability | Idempotency keys; PostgreSQL concurrency tests; defined cancellation and correction workflow | Retrying an invoice cannot duplicate stock or debt; concurrent sales cannot oversell |
| Fulfilment | Define draft/partial/delivered transitions and post movements on actual receipt/delivery | Partially received/delivered quantities reconcile with stock |
| Operations | Strong production secret, database readiness checks, migration-only production startup, backups and restore drill | Restore a test business from backup and run smoke checks |
| Launch | Provision backend/database, frontend environment and CORS; verify live HTTPS trade cycle | Public deployment passes the same workflow checks as the local demo |
| Native mobile | Recheck Expo companion separately; bring posting workflows to parity where intended | Device checks and explicitly documented feature scope |

SQLite is a development convenience. PostgreSQL row locks are used when validating order stock, but concurrent posting has not been validated against a hosted PostgreSQL database. The khata overview batches party and entry reads into two queries; summary queries still need profiling at larger data volumes.

## Practical launch sequence

1. Complete tenant and permission isolation before a public multi-business signup.
2. Finish accounting and posting reliability gates.
3. Deploy a small pilot using Vercel for the frontend and a cost-conscious backend/PostgreSQL option such as Koyeb and Neon; confirm current plan limits before provisioning.
4. Pilot with a single wholesaler using synthetic data first, then verify opening stock and party balances with the owner before importing real records.
5. Measure time to record a sale, reconcile khata, and prepare a reorder. Use that evidence for the portfolio case study and a paid implementation offer.

Do not describe this milestone as production-complete or invent deployment, business impact, or customer claims.
