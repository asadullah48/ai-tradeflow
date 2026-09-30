/**
 * Serves the TradeFlow API from the browser (NEXT_PUBLIC_DEMO_MODE=browser).
 *
 * Same routes, status codes and error shapes as the FastAPI backend, backed
 * by lib/demo/engine.ts and persisted to this browser's localStorage — so
 * the public demo costs nothing to host and every visitor gets private,
 * resettable books. Point NEXT_PUBLIC_API_URL at a real backend and unset
 * the demo flag to use the API instead; the UI does not change.
 */
import {
  BUCKETS, DemoError, addDays, allBalances, askMunshi, collections, createPurchase, createSale, dailySummary,
  dashboard, partyAging, partyBalance, profitSummary, recomputeStock, recordEntry, round2, statementText,
  todayIso, velocity, voidOrder, type DemoState, type ItemInput, type Order, type User,
} from "./engine";
import { buildDemoState, DEMO_VERSION } from "./seed";
import { textPdf } from "./pdf";

const KEY = "tradeflow-demo-books";
let cache: DemoState | null = null;

function load(): DemoState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.version === DEMO_VERSION) return (cache = parsed);
    }
  } catch {}
  cache = buildDemoState();
  save(cache);
  return cache;
}
function save(s: DemoState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}
export function resetDemoBooks() {
  cache = buildDemoState();
  save(cache);
}
export function demoSeededOn(): string | null {
  return cache?.seeded_on ?? null;
}

export type DemoResponse = { status: number; body: unknown; headers?: Record<string, string> };

const ok = (body: unknown, status = 200, headers?: Record<string, string>): DemoResponse => ({ status, body, headers });
const fail = (status: number, detail: unknown): DemoResponse => ({ status, body: { detail } });

function userFrom(s: DemoState, auth: string | undefined): User | null {
  const token = auth?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token.startsWith("demo-token:")) return null;
  return s.users.find((u) => u.id === token.slice("demo-token:".length)) ?? null;
}

const publicUser = (u: User) => ({ id: u.id, name: u.name, phone: u.phone, role: u.role });
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const outOrder = (o: Order) => {
  const c = clone(o) as Partial<Order>;
  delete c.idempotency_key;
  delete c.created_by;
  return c;
};

function num(v: unknown, field: string, { min, gt }: { min?: number; gt?: number } = {}): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || (min !== undefined && n < min) || (gt !== undefined && n <= gt))
    throw new DemoError(422, [{ loc: ["body", field], msg: "Invalid value" }]);
  return n;
}

type Body = Record<string, unknown>;

export async function demoRequest(method: string, rawPath: string, body: Body | undefined,
  headers: Record<string, string>): Promise<DemoResponse> {
  await new Promise((r) => setTimeout(r, 90)); // feel like a network round-trip
  const s = load();
  const url = new URL(rawPath, "http://demo.local");
  const path = url.pathname.replace(/\/$/, "");
  const q = url.searchParams;
  const m = method.toUpperCase();
  const idem = (headers["Idempotency-Key"] ?? headers["idempotency-key"] ?? "").trim().slice(0, 120) || null;
  try {
    const res = route(s, m, path, q, body ?? {}, headers.Authorization, idem);
    if (m !== "GET") save(s);
    return res;
  } catch (e) {
    if (e instanceof DemoError) {
      if (m !== "GET") {
        // Posting is atomic in the API; roll the in-memory books back too.
        cache = null;
      }
      return fail(e.status, e.detail);
    }
    cache = null;
    return fail(500, "Unexpected error in the browser demo. Try resetting the demo books.");
  }
}

function route(s: DemoState, m: string, path: string, q: URLSearchParams, b: Body, auth: string | undefined,
  idem: string | null): DemoResponse {
  if (m === "POST" && path === "/auth/login") {
    const u = s.users.find((x) => x.phone === String(b.phone ?? "") && x.password === String(b.password ?? ""));
    return u ? ok({ access_token: `demo-token:${u.id}`, token_type: "bearer" }) : fail(401, "Invalid phone or password");
  }
  if (m === "POST" && path === "/auth/register")
    return fail(403, "The public demo runs entirely in your browser, so sign-up is off. Use the demo owner or munshi login.");
  if (path === "/health") return ok({ status: "ok" });

  const user = userFrom(s, auth);
  if (!user) return fail(401, "Invalid or expired token");
  const owner = () => {
    if (user.role !== "owner") throw new DemoError(403, "Only the business owner can do this");
  };
  let hit: RegExpMatchArray | null;

  if (m === "GET" && path === "/auth/me")
    return ok({ ...publicUser(user), business_id: s.business.id, business_name: s.business.name });
  if (m === "GET" && path === "/team") return ok(s.users.map(publicUser));
  if (m === "POST" && path === "/team") {
    owner();
    const phone = String(b.phone ?? "");
    if (!/^\+?[0-9]{10,14}$/.test(phone) || String(b.password ?? "").length < 8 || !String(b.name ?? "").trim())
      throw new DemoError(422, "Enter a name, a valid phone number and a password of at least 8 characters");
    if (s.users.some((u) => u.phone === phone)) throw new DemoError(400, "A user with this phone number already exists");
    const u: User = { id: `demo-user-${s.users.length + 1}`, name: String(b.name), phone, role: "munshi", password: String(b.password) };
    s.users.push(u);
    return ok(publicUser(u), 201);
  }

  /* parties */
  if (path === "/parties" && m === "GET") {
    const term = (q.get("q") ?? "").toLowerCase();
    return ok(clone(s.parties.filter((p) => !term || p.name.toLowerCase().includes(term) || (p.name_ur ?? "").includes(term))
      .sort((a, c) => a.name.localeCompare(c.name))));
  }
  if (path === "/parties" && m === "POST") {
    if (!String(b.name ?? "").trim()) throw new DemoError(422, "Name is required");
    const type = String(b.type ?? "customer");
    if (!["customer", "supplier", "both"].includes(type)) throw new DemoError(422, "Invalid party type");
    const p = { id: `party-${Date.now().toString(36)}`, name: String(b.name).trim(), name_ur: (b.name_ur as string) || null,
      type: type as "customer", phone: (b.phone as string) || null, city: (b.city as string) || null,
      credit_limit: num(b.credit_limit ?? 0, "credit_limit", { min: 0 }), opening_balance: num(b.opening_balance ?? 0, "opening_balance"),
      created_at: new Date().toISOString() };
    s.parties.push(p);
    return ok(p, 201);
  }
  if ((hit = path.match(/^\/parties\/([^/]+)$/))) {
    const p = s.parties.find((x) => x.id === hit![1]);
    if (!p) throw new DemoError(404, "Party not found");
    if (m === "GET") return ok(clone(p));
    if (m === "PATCH") {
      for (const k of ["name", "name_ur", "type", "phone", "city"] as const) if (k in b) (p as Record<string, unknown>)[k] = b[k] || null;
      if ("credit_limit" in b) p.credit_limit = num(b.credit_limit, "credit_limit", { min: 0 });
      if (!p.name) throw new DemoError(422, "Name is required");
      return ok(clone(p));
    }
    if (m === "DELETE") {
      owner();
      const history = s.ledger.some((e) => e.party_id === p.id) || s.sale_orders.some((o) => o.party_id === p.id) ||
        s.purchase_orders.some((o) => o.party_id === p.id);
      if (history || p.opening_balance) throw new DemoError(409, "This party has khata or order history and cannot be deleted");
      s.parties = s.parties.filter((x) => x.id !== p.id);
      return ok(undefined, 204);
    }
  }

  /* products */
  if (path === "/products" && m === "GET") {
    const term = (q.get("q") ?? "").toLowerCase();
    return ok(clone(s.products.filter((p) => !term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) ||
      (p.name_ur ?? "").includes(term)).sort((a, c) => a.name.localeCompare(c.name))));
  }
  if (path === "/products" && m === "POST") {
    const sku = String(b.sku ?? "").trim();
    if (!sku || !String(b.name ?? "").trim()) throw new DemoError(422, "SKU and name are required");
    if (s.products.some((p) => p.sku === sku)) throw new DemoError(400, "A product with this SKU already exists");
    const p = { id: `prod-${Date.now().toString(36)}`, sku, name: String(b.name).trim(), name_ur: (b.name_ur as string) || null,
      category: (b.category as string) || null, unit: String(b.unit ?? "piece"),
      cost_price: num(b.cost_price ?? 0, "cost_price", { min: 0 }), sale_price: num(b.sale_price ?? 0, "sale_price", { min: 0 }),
      min_stock_level: num(b.min_stock_level ?? 0, "min_stock_level", { min: 0 }), current_stock: 0,
      created_at: new Date().toISOString() };
    s.products.push(p);
    return ok(p, 201);
  }
  if ((hit = path.match(/^\/products\/([^/]+)(\/recompute-stock)?$/))) {
    const p = s.products.find((x) => x.id === hit![1]);
    if (!p) throw new DemoError(404, "Product not found");
    if (hit[2] && m === "POST") {
      recomputeStock(s, p.id);
      return ok(clone(p));
    }
    if (m === "GET") return ok(clone(p));
    if (m === "PATCH") {
      for (const k of ["name", "name_ur", "category"] as const) if (k in b) (p as Record<string, unknown>)[k] = b[k] || null;
      for (const k of ["cost_price", "sale_price", "min_stock_level"] as const)
        if (k in b) p[k] = num(b[k], k, { min: 0 });
      if (!p.name) throw new DemoError(422, "Name is required");
      return ok(clone(p));
    }
  }

  /* orders */
  for (const [prefix, kind] of [["/purchase-orders", "purchase"], ["/sale-orders", "sale"]] as const) {
    const list = kind === "sale" ? s.sale_orders : s.purchase_orders;
    const label = kind === "sale" ? "Sale order" : "Purchase order";
    if (path === prefix && m === "GET")
      return ok([...list].sort((a, c) => (c.date + c.created_at).localeCompare(a.date + a.created_at)).map(outOrder));
    if (path === prefix && m === "POST") {
      if (idem) {
        const existing = list.find((o) => o.idempotency_key === idem);
        if (existing) return ok(outOrder(existing), 200, { "Idempotent-Replay": "true" });
      }
      const items = (Array.isArray(b.items) ? b.items : []).map((i: Record<string, unknown>, n: number): ItemInput => ({
        product_id: String(i.product_id ?? ""), qty: num(i.qty, `items.${n}.qty`, { gt: 0 }),
        unit_price: num(i.unit_price, `items.${n}.unit_price`, { min: 0 }),
      }));
      if (!items.length) throw new DemoError(400, "An order needs at least one item");
      const date = String(b.date ?? todayIso());
      const method = (b.ledger_method as string | null) ?? null;
      if (b.override_credit_limit && user.role !== "owner")
        throw new DemoError(403, "Only the business owner can override a credit limit");
      const args = { party_id: String(b.party_id ?? ""), date, items, ledger_method: method, created_by: user.id,
        idempotency_key: idem };
      const order = kind === "sale" ? createSale(s, { ...args, override_credit_limit: !!b.override_credit_limit })
        : createPurchase(s, args);
      return ok(outOrder(order), 201);
    }
    if ((hit = path.match(new RegExp(`^${prefix}/([^/]+)(/void)?$`)))) {
      const order = list.find((o) => o.id === hit![1]);
      if (!order) throw new DemoError(404, `${label} not found`);
      if (hit[2] && m === "POST") {
        owner();
        const reason = String(b.reason ?? "").trim();
        if (reason.length < 3) throw new DemoError(422, "Give a reason of at least 3 characters");
        return ok(outOrder(voidOrder(s, order, kind === "sale", reason, user.id)));
      }
      if (m === "GET") return ok(outOrder(order));
    }
  }

  /* ledger */
  if (path === "/ledger/entries" && m === "POST") {
    if (idem) {
      const existing = s.ledger.find((e) => e.idempotency_key === idem);
      if (existing) return ok(clone(existing), 200, { "Idempotent-Replay": "true" });
    }
    const method = String(b.method ?? "cash");
    if (!["cash", "bank", "jazzcash", "easypaisa", "udhaar"].includes(method)) throw new DemoError(422, "Invalid method");
    const entry = recordEntry(s, { party_id: String(b.party_id ?? ""), date: String(b.date ?? todayIso()),
      type: String(b.type ?? ""), amount: num(b.amount, "amount", { gt: 0 }), method,
      ref_order_id: (b.ref_order_id as string) || null, note: (b.note as string) || null, created_by: user.id,
      idempotency_key: idem });
    return ok(clone(entry), 201);
  }
  if (path === "/ledger/balances" && m === "GET") return ok(allBalances(s));
  if ((hit = path.match(/^\/ledger\/parties\/([^/]+)(\/balance)?$/)) && m === "GET") {
    const id = hit[1];
    if (hit[2]) {
      const p = s.parties.find((x) => x.id === id);
      if (!p) throw new DemoError(404, "Party not found");
      const aging = partyAging(s, id);
      return ok({ party_id: p.id, party_name: p.name, balance: partyBalance(s, id),
        aging: BUCKETS.map((l) => ({ label: l, amount: aging[l] })) });
    }
    return ok(s.ledger.filter((e) => e.party_id === id)
      .sort((a, c) => (a.date + a.created_at).localeCompare(c.date + c.created_at)).map(clone));
  }

  if (path === "/collections" && m === "GET") return ok(collections(s));
  if (path === "/dashboard" && m === "GET") return ok(dashboard(s));
  if (path === "/reports/daily-summary" && m === "GET") return ok({ text: dailySummary(s, q.get("on_date") ?? todayIso()) });
  if ((hit = path.match(/^\/reports\/party-statement\/([^/]+)(\/pdf)?$/)) && m === "GET") {
    if (!hit[2]) return ok({ text: statementText(s, hit[1]) });
    return ok(statementPdf(s, hit[1]));
  }
  if (path === "/agent/ask" && m === "POST") {
    const question = String(b.question ?? "").trim();
    if (!question || question.length > 2000) throw new DemoError(422, "Ask a question of up to 2000 characters");
    return ok(askMunshi(s, question));
  }
  if (path === "/reports/profit" && m === "GET") {
    const end = todayIso();
    return ok(profitSummary(s, q.get("start") ?? addDays(end, -30), q.get("end") ?? end));
  }
  if (path === "/reports/velocity" && m === "GET") return ok(velocity(s, 30));
  return fail(404, "Not Found");
}

function statementPdf(s: DemoState, partyId: string): Blob {
  const p = s.parties.find((x) => x.id === partyId);
  if (!p) throw new DemoError(404, `Party ${partyId} not found`);
  const balance = partyBalance(s, partyId);
  const aging = partyAging(s, partyId);
  const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lines: { text: string; font?: "F1" | "F2" | "F3"; size?: number; gap?: number }[] = [
    { text: s.business.name, font: "F2", size: 18, gap: 10 },
    { text: `Khata statement: ${p.name}${p.city ? ` - ${p.city}` : ""}`, size: 11, gap: 22 },
    { text: `Generated ${todayIso()}  (browser demo - fictional data)`, size: 9 },
    { text: `Balance: Rs ${money(Math.abs(balance))} ${balance > 0 ? "(receivable - they owe you)" : balance < 0 ? "(payable - you owe them)" : "(settled)"}`,
      font: "F2", size: 12, gap: 26 },
    { text: `Current Rs ${money(aging.current)}   30+ Rs ${money(aging["30"])}   60+ Rs ${money(aging["60"])}   90+ Rs ${money(aging["90+"])}`,
      size: 9, gap: 16 },
    { text: `${"Date".padEnd(11)}${"Details".padEnd(34)}${"Debit".padStart(13)}${"Credit".padStart(13)}${"Balance".padStart(14)}`,
      font: "F3", size: 8, gap: 24 },
  ];
  let running = p.opening_balance;
  for (const e of s.ledger.filter((x) => x.party_id === partyId)
    .sort((a, c) => (a.date + a.created_at).localeCompare(c.date + c.created_at))) {
    running = round2(running + (e.type === "debit" ? e.amount : -e.amount));
    const note = e.note ?? "Entry";
    const full = e.method === "udhaar" ? note : `${note} (${e.method})`;
    const details = full.length > 33 ? `${full.slice(0, 32)}~` : full;
    lines.push({ text: `${e.date.padEnd(11)}${details.padEnd(34)}${(e.type === "debit" ? money(e.amount) : "").padStart(13)}` +
      `${(e.type === "credit" ? money(e.amount) : "").padStart(13)}${money(running).padStart(14)}`, font: "F3", size: 8, gap: 11 });
  }
  lines.push({ text: "Debit increases what the party owes; credit is a payment or reversal.", size: 8, gap: 22 });
  return textPdf(lines, `Statement - ${p.name}`);
}
