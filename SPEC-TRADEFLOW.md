# SPEC-TRADEFLOW.md
## AI TradeFlow — AI-Powered Inventory & Accounting Platform for Pakistan's Wholesalers

**Project:** AI TradeFlow — Portfolio Project 1 of the "AI for Pakistan Trade" series
**Public commitment:** Mission announced on LinkedIn (Aug 19, 2026) with AI TradeFlow vision banner. Banner promises the full platform (sourcing, marketing, logistics, documentation, negotiation); this spec covers **v1 = the wholesaler back-office module only**. Launch communications must state the build order explicitly: back-office first, sourcing later.
**Author:** Asadullah Shafique (github.com/asadullah48)
**Methodology:** Spec-First, Four-Session Execution
**Base repos (reuse sources):** cmt-stitching-system (primary), masala-store (bilingual UI), h3-advanced-todo (agent patterns, constitutional AI)
**Status:** DRAFT — execute after P3-FDEAGA exam and DriveEase/Masala Phase 4 completion
**Target start:** Early September 2026

---

## Execution note (2026-08-19)

This spec's own status line says "DRAFT" with a target start of early
September 2026. On explicit instruction, all four sessions below were
executed immediately instead, in one continuous build. Deviations from
the plan as originally written:

1. `masala-store` (the bilingual UI reuse source) could not be located on
   this machine. The i18n/RTL layer was built fresh - a lightweight
   custom React context (`frontend/lib/i18n.tsx`), not `next-intl` and
   not ported from masala-store - per explicit instruction.
2. Demo persona: general goods wholesale (Jodia Bazaar-style), not spices,
   since the spices persona was tied to the unavailable Masala Store
   domain familiarity.
3. Repo/brand naming (Open Decision #0, added in the v2 spec update):
   the repo was already created and pushed as `tradeflow` under the v1
   spec before the "AI TradeFlow" brand name and the `ai-tradeflow`
   naming lean arrived. **Not renamed without confirmation** - see the
   chat response accompanying this update for the rename question.
4. The "Positioning" and "Business" rows in §10 (LinkedIn ship-announcement
   post, DM-collected early-tester names, wholesaler demo conversations)
   are marketing/business-development actions on the author's own
   accounts - outside what an engineering build in this repo can do or
   verify. Not attempted here; flagged, not silently marked done.

Everything else follows the plan below as written.

---

## 1. Vision & Problem Statement

Pakistan's wholesalers and traders (Jodia Bazaar, Shershah, Akbari Mandi, and thousands of smaller markets) run multi-crore operations on paper registers (khata), WhatsApp voice notes, and memory. The consequences:

- **No real-time stock visibility** — over-ordering dead stock, stock-outs on fast movers
- **Udhaar (credit) chaos** — receivables tracked in registers, disputes common, no aging view
- **Zero decision support** — reorder decisions made on gut feel, not sales velocity
- **Language barrier** — existing ERPs (SAP B1, QuickBooks, local clones) are English-first, desktop-first, and priced for corporations

**TradeFlow** is a bilingual (Urdu + English), mobile-first, AI-augmented inventory and accounting system priced and designed for a single wholesaler or small trading firm. Its differentiator is not the CRUD — it is the **agentic layer**: a Digital FTE ("Munshi AI") that reads the business's own data and answers questions like *"is haftay kya order karna chahiye?"* with grounded, explainable recommendations.

This project is the proof-of-work behind the LinkedIn positioning: *Building AI Platforms for Pakistan's Import-Export & Trade Economy.*

---

## 2. Constitutional Rules (TradeFlow Constitution)

Following the constitutional enforcement pattern from H3 and Course Companion FTE:

**BLOCK patterns (hard refusals in Munshi AI):**
1. Tax evasion assistance (fabricating invoices, dual-book suggestions)
2. Financial fraud (fake receivables, ghost inventory for loan collateral)
3. Interest (riba)-based lending calculations presented as advice — report data neutrally only
4. Smuggling / undeclared goods workflows
5. Fabricated numbers — the agent may NEVER invent a figure not derivable from the database

**FLAG patterns (human-in-the-loop review):**
1. Bulk deletion of ledger entries
2. Backdated transaction edits beyond 7 days
3. Credit limit overrides above configured threshold

**Architecture rule (from Course Companion FTE):** All financial calculations happen in deterministic backend code — the LLM narrates and recommends, it never computes money. Zero LLM-computed arithmetic in any ledger path.

---

## 3. Reuse Map

Target: ≥70% reuse (consistent with H2→H3 trajectory).

| Module | Source | Reuse | Work Required |
|---|---|---|---|
| Order management (CRUD, status flow) | cmt-stitching-system | ~85% | Rename domain: production orders → purchase/sale orders |
| Inventory tracking | cmt-stitching-system | ~75% | Generalize: garment pieces → SKU + category + unit (piece/dozen/carton/kg) |
| Financial ledger | cmt-stitching-system | ~70% | Add: udhaar (receivables/payables) aging, partial payments |
| Auth (JWT) | cmt-stitching-system | ~95% | Add role: owner / munshi (staff) |
| Bilingual UI (EN + UR, RTL) | masala-store HomeScreen | ~80% | Extend i18n dictionary to accounting vocabulary |
| Next.js 14 App Router shell | DriveEase / Masala web | ~90% | Rebrand, new nav |
| FastAPI + SQLAlchemy + PostgreSQL scaffold | all repos | ~95% | New models |
| Constitutional AI middleware | h3-advanced-todo | ~80% | Swap patterns to TradeFlow constitution (§2) |
| Agent + MCP patterns | H5 Agent Factory / SKILL.md assets | ~60% | New SKILL.md: inventory-advisor |
| Test harness (pytest + fixtures) | h3-advanced-todo (149 tests) | ~85% | New fixtures for trade domain |

**New builds (no reuse source):** Udhaar aging engine, sales-velocity analytics service, Munshi AI agent + its SKILL.md, WhatsApp-format report export.

---

## 4. Technical Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 14 (App Router), Tailwind, Zustand | Standard stack; mobile-first responsive (traders use phones) |
| i18n | next-intl, RTL support | Urdu-first UI |
| Backend | FastAPI + SQLAlchemy | Standard stack |
| Database | PostgreSQL (prod) / SQLite (dev) | Standard stack |
| Agent | OpenAI Agents SDK custom agent, built via Claude Code (General Agent) | H5 two-tier architecture, applied commercially |
| Agent tools | MCP server exposing read-only analytics endpoints | Agent Factory pattern; agent cannot mutate ledger |
| Intelligence asset | `SKILL.md` — inventory-advisor | Portable, reusable, monetizable unit (Digital FTE catalog item #1) |
| Deployment | Vercel (web) + Railway (API + DB) | Same as DriveEase/Masala Phase 4 |
| CI | GitHub Actions | Existing workflow templates |

**Deliberately out of scope for v1:** Kubernetes/Dapr, mobile app (Expo build optional in v2), FBR tax integration, multi-branch sync, barcode scanning.

**Banner-promised, deferred to later phases:** supplier search/matching ("2,418 verified"), shipment/order tracking, automated logistics, price negotiation agent. These belong to the TradeGuide/sourcing roadmap (~6+ months out). Do not let DM interest in these pull scope into v1.

**Adjacent market (parked):** schools/colleges fee-ledger use case (mentioned in launch post). The ledger + aging engine ports to fee management with ~30% rework - treat as opportunistic v1.x revenue if a client appears, but keep all public positioning on the trade economy niche.

---

## 5. Data Models (Core)

```
Party        — id, name, name_ur, type(customer|supplier|both), phone, city,
               credit_limit, opening_balance
Product      — id, sku, name, name_ur, category, unit(piece|dozen|carton|kg|meter),
               cost_price, sale_price, min_stock_level, current_stock
PurchaseOrder— id, party_id, date, status(draft|received|partial|paid), items[], total
SaleOrder    — id, party_id, date, status(draft|delivered|partial|paid), items[], total
OrderItem    — order_id, product_id, qty, unit_price, line_total
LedgerEntry  — id, party_id, date, type(debit|credit), amount, ref_order_id,
               method(cash|bank|jazzcash|easypaisa|udhaar), note, created_by
StockMovement— id, product_id, date, qty_delta, reason(purchase|sale|adjustment|return),
               ref_order_id
User         — id, name, phone, role(owner|munshi), password_hash
AgentQuery   — id, user_id, question, answer, tools_called[], flagged, created_at
```

**Invariants (enforced in backend, tested):**
- `current_stock` = opening + Σ(StockMovement.qty_delta) — recomputable, never trusted from client
- Party balance = opening_balance + Σ(debits) − Σ(credits) — derived, never stored as editable field
- Every LedgerEntry of method=udhaar must reference an order

---

## 6. Feature Scope (v1 MVP)

### F1 — Parties & Products (bilingual CRUD)
Customer/supplier directory and product catalog, Urdu + English names, search in both scripts.

### F2 — Purchase & Sale Orders
Order entry optimized for speed. Partial delivery and partial payment states. Auto stock movements.

### F3 — Khata (Ledger + Udhaar)
Per-party ledger view mirroring a traditional khata register. Receivables/payables aging buckets: current / 30 / 60 / 90+. Payment recording across cash, bank, JazzCash, Easypaisa, udhaar.

### F4 — Dashboard
Today's sales, stock alerts (below min_stock_level), top udhaar exposure, fast-moving vs dead stock (last 30 days velocity).

### F5 — Munshi AI (the differentiator)
Chat interface (Urdu + English input) backed by the custom agent. Capabilities:
- "Is haftay kya order karna chahiye?" → reorder recommendations from sales velocity + current stock + lead-time heuristic
- "Kis ka udhaar sab se purana hai?" → aging analysis with follow-up suggestions
- "Pichlay mahinay ka profit summary" → narrated P&L from deterministic backend figures
- Every answer cites the data it used (tools_called logged in AgentQuery)
- Constitutional middleware wraps every request (§2)

### F6 — WhatsApp-Ready Reports
One-tap export of daily summary / party statement as formatted text + PDF, sized for WhatsApp forwarding.

---

## 7. Munshi AI — Agent Architecture

Two-tier Agent Factory pattern:

```
Claude Code (General Agent)
    └── builds & maintains → Munshi AI (Custom Agent, OpenAI Agents SDK)
            └── consumes → SKILL.md: inventory-advisor
            └── connects via → TradeFlow MCP Server (read-only)
                    ├── tool: get_sales_velocity(product_id?, days)
                    ├── tool: get_stock_status(below_min_only?)
                    ├── tool: get_receivables_aging(party_id?)
                    ├── tool: get_profit_summary(date_range)
                    └── tool: get_party_statement(party_id, date_range)
```

**SKILL.md: inventory-advisor** — encodes reorder logic (velocity × lead time + safety stock), udhaar follow-up etiquette, and report narration style. Digital FTE catalog item #1.

**Hard boundary:** MCP server exposes zero mutation tools. The agent advises; humans act.

---

## 8. Four-Session Execution Plan

### Session 1 — Foundation
- New repo, SQLAlchemy models (§5) + Alembic migrations
- Auth with owner/munshi roles
- Parties + Products CRUD (API + UI), bilingual fields
- i18n scaffold
- Checkpoint: create supplier + product in Urdu UI, data persists, 25+ tests passing

### Session 2 — Integration
- Purchase/Sale orders end-to-end with stock movements
- Ledger engine: entries, derived balances, udhaar aging buckets
- Invariant test suite
- Dashboard v1
- Checkpoint: full trade cycle reflected correctly in khata; 60+ tests passing

### Session 3 — Advanced / Agentic
- TradeFlow MCP server (5 read-only tools)
- SKILL.md: inventory-advisor
- Munshi AI via OpenAI Agents SDK
- Constitutional middleware + AgentQuery audit log
- Chat UI (Urdu/English input)
- Checkpoint: all three flagship questions answered with cited tool calls; BLOCK patterns verified refused; 85+ tests passing

### Session 4 — Validation & Ship
- WhatsApp report export (text + PDF)
- Seed script: realistic demo dataset
- Deploy: Vercel + Railway, GitHub Actions CI
- README with architecture diagram
- SESSION-1..4-SUMMARY.md finalized
- Checkpoint: demo dataset loaded, 100+ tests passing, repo public

---

## 9. Testing Strategy

- **Unit:** model invariants (§5), ledger math, aging bucket edges, velocity calculations
- **Integration:** full trade-cycle flows, partial payment paths
- **Agent:** golden-question suite, constitutional refusal suite, tool-citation assertions
- **Target:** 100+ tests by Session 4

---

## 10. Success Criteria

| Category | Target |
|---|---|
| Reuse | ≥70% measured against CMT/H3 sources |
| Tests | 100+ passing, agent suite included |
| Performance | <500 ms p95 on API |
| Agent quality | 3 flagship questions answered correctly with citations on demo dataset |
| Ship | Live demo URL + public repo + README by end of Session 4 |
| Positioning | Mission post DONE (Aug 19, per author). Remaining: 1 ship-announcement post at Session 4 (Stratified Signal visual, "back-office first" framing) - **not done by this build; a marketing action on the author's own LinkedIn account** |
| Business | 5-10 early-tester names from launch-post DMs before Session 1; 2 real wholesaler demo conversations by Session 4 - **not done by this build; business-development actions outside repo scope** |

---

## 11. Open Decisions

1. **Urdu input for Munshi AI:** Both Urdu script and Roman Urdu accepted as input, Roman Urdu output default. *Resolved 2026-08-19.*
2. **Multi-tenancy:** `tenant_id` column added to every table now; not yet enforced at the query layer. *Resolved 2026-08-19.*
3. **Repo strategy:** Fresh repo (`tradeflow`), no fork. *Resolved 2026-08-19.*
4. **Demo persona:** General goods wholesale (Jodia Bazaar-style) - spices persona depended on the unavailable Masala Store domain. *Resolved 2026-08-19.*
0. **Repo/brand naming** (added in the v2 spec update): repo `tradeflow` vs `ai-tradeflow` to match the public "AI TradeFlow" brand. **Open** - the repo already exists and is pushed publicly as `tradeflow`; renaming is possible (`gh repo rename`) but changes the public URL anyone who saw it already has. Needs explicit confirmation before acting - not resolved as part of this build.

---

## 12. Post-v1 Roadmap (not in scope)

v1.1: Expo mobile app (EAS build) · v1.2: Multi-user with per-munshi permissions · v1.3: JazzCash/Easypaisa payment link generation · v2: Second SKILL.md asset (purchase-negotiation-advisor), TradeGuide integration
