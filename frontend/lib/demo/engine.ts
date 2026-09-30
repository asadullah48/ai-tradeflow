/**
 * The browser demo's business rules — a TypeScript port of the FastAPI
 * service layer (backend/app/services + backend/app/agent), so the public
 * demo behaves like the real API without a server:
 *
 *  - purchases re-average cost (weighted average); sales snapshot it
 *  - stock, invoice and settlement post together; overselling is refused
 *  - udhaar sales respect the customer's credit limit (owner may override)
 *  - posted orders are corrected only by voids that append reversals
 *  - khata balances and invoice-aware FIFO aging, collections ranking
 *  - Munshi AI: the deterministic constitution + offline tool-grounded answers
 *
 * Money is rounded to the paisa at every posting boundary, matching the
 * backend's Decimal quantization.
 */

export type Party = {
  id: string;
  name: string;
  name_ur: string | null;
  type: "customer" | "supplier" | "both";
  phone: string | null;
  city: string | null;
  credit_limit: number;
  opening_balance: number;
  created_at: string;
};
export type Product = {
  id: string;
  sku: string;
  name: string;
  name_ur: string | null;
  category: string | null;
  unit: string;
  cost_price: number;
  sale_price: number;
  min_stock_level: number;
  current_stock: number;
  created_at: string;
};
export type OrderItem = {
  id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  line_total: number;
  unit_cost: number | null;
};
export type Order = {
  id: string;
  party_id: string;
  date: string;
  status: string;
  total: number;
  items: OrderItem[];
  void_reason: string | null;
  idempotency_key: string | null;
  created_by: string | null;
  created_at: string;
};
export type LedgerEntry = {
  id: string;
  party_id: string;
  date: string;
  type: "debit" | "credit";
  amount: number;
  ref_order_id: string | null;
  method: string;
  note: string | null;
  created_by: string | null;
  idempotency_key: string | null;
  created_at: string;
};
export type Movement = {
  id: string;
  product_id: string;
  date: string;
  qty_delta: number;
  reason: string;
  ref_order_id: string | null;
};
export type User = { id: string; name: string; phone: string; role: "owner" | "munshi"; password: string };
export type DemoState = {
  version: number;
  seeded_on: string;
  business: { id: string; name: string; city: string };
  users: User[];
  parties: Party[];
  products: Product[];
  purchase_orders: Order[];
  sale_orders: Order[];
  ledger: LedgerEntry[];
  movements: Movement[];
  seq: number;
};

export class DemoError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : "Request failed");
    this.status = status;
    this.detail = detail;
  }
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const fmt0 = (n: number) => Math.round(n).toLocaleString("en-US");

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function todayIso(): string {
  return isoDate(new Date());
}
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return isoDate(dt);
}
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

export function newId(state: DemoState, prefix: string): string {
  state.seq += 1;
  return `${prefix}-${state.seq.toString(36).padStart(5, "0")}`;
}
const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ stock */

function recordMovement(s: DemoState, productId: string, qtyDelta: number, reason: string, ref: string | null, date: string) {
  s.movements.push({ id: newId(s, "mv"), product_id: productId, date, qty_delta: qtyDelta, reason, ref_order_id: ref });
  const p = s.products.find((x) => x.id === productId);
  if (p) p.current_stock = round3(p.current_stock + qtyDelta);
}

export function recomputeStock(s: DemoState, productId: string): number {
  const stock = round3(s.movements.filter((m) => m.product_id === productId).reduce((a, m) => a + m.qty_delta, 0));
  const p = s.products.find((x) => x.id === productId);
  if (p) p.current_stock = stock;
  return stock;
}

/* ----------------------------------------------------------------- ledger */

export function recordEntry(
  s: DemoState,
  e: { party_id: string; date: string; type: string; amount: number; method?: string; ref_order_id?: string | null;
       note?: string | null; created_by?: string | null; idempotency_key?: string | null },
): LedgerEntry {
  if (!s.parties.find((p) => p.id === e.party_id)) throw new DemoError(400, "Party not found");
  if (e.type !== "debit" && e.type !== "credit") throw new DemoError(400, "Invalid ledger entry type");
  if (!(e.amount > 0)) throw new DemoError(400, "Ledger entry amount must be positive");
  const method = e.method ?? "cash";
  if (method === "udhaar" && !e.ref_order_id)
    throw new DemoError(400, "A udhaar ledger entry must reference an order (ref_order_id)");
  const entry: LedgerEntry = {
    id: newId(s, "le"), party_id: e.party_id, date: e.date, type: e.type as "debit" | "credit",
    amount: round2(e.amount), ref_order_id: e.ref_order_id ?? null, method, note: e.note ?? null,
    created_by: e.created_by ?? null, idempotency_key: e.idempotency_key ?? null, created_at: now(),
  };
  s.ledger.push(entry);
  return entry;
}

export function partyBalance(s: DemoState, partyId: string): number {
  const party = s.parties.find((p) => p.id === partyId);
  if (!party) throw new DemoError(404, "Party not found");
  const sum = s.ledger.filter((e) => e.party_id === partyId)
    .reduce((a, e) => a + (e.type === "debit" ? e.amount : -e.amount), 0);
  return round2(party.opening_balance + sum);
}

export const BUCKETS = ["current", "30", "60", "90+"] as const;
export type Bucket = (typeof BUCKETS)[number];

function bucketFor(days: number): Bucket {
  if (days < 30) return "current";
  if (days < 60) return "30";
  if (days < 90) return "60";
  return "90+";
}

/** Invoice-aware FIFO aging — a line-for-line port of ledger_service._age_entries. */
export function ageEntries(entries: LedgerEntry[], asOf: string): Record<Bucket, number> {
  const debits = entries.filter((e) => e.type === "debit")
    .map((e) => ({ date: e.date, remaining: e.amount, ref: e.ref_order_id }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let remainingCredit = 0;
  for (const credit of entries.filter((e) => e.type === "credit")) {
    let unallocated = credit.amount;
    if (credit.ref_order_id) {
      for (const d of debits) {
        if (d.ref === credit.ref_order_id) {
          const applied = Math.min(d.remaining, unallocated);
          d.remaining -= applied;
          unallocated -= applied;
        }
      }
    }
    remainingCredit += unallocated;
  }
  for (const d of debits) {
    if (remainingCredit <= 0) break;
    const applied = Math.min(d.remaining, remainingCredit);
    d.remaining -= applied;
    remainingCredit -= applied;
  }
  const out: Record<Bucket, number> = { current: 0, "30": 0, "60": 0, "90+": 0 };
  for (const d of debits) {
    if (d.remaining <= 0.000001) continue;
    out[bucketFor(daysBetween(d.date, asOf))] += d.remaining;
  }
  for (const b of BUCKETS) out[b] = round2(out[b]);
  return out;
}

export function partyAging(s: DemoState, partyId: string, asOf = todayIso()) {
  return ageEntries(s.ledger.filter((e) => e.party_id === partyId), asOf);
}

export function allBalances(s: DemoState) {
  const grouped = new Map<string, LedgerEntry[]>();
  for (const e of s.ledger) grouped.set(e.party_id, [...(grouped.get(e.party_id) ?? []), e]);
  const today = todayIso();
  return [...s.parties].sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
    const entries = grouped.get(p.id) ?? [];
    const balance = round2(p.opening_balance + entries.reduce((a, e) => a + (e.type === "debit" ? e.amount : -e.amount), 0));
    const aging = ageEntries(entries, today);
    return { party_id: p.id, party_name: p.name, balance, aging: BUCKETS.map((b) => ({ label: b, amount: aging[b] })) };
  });
}

/* ----------------------------------------------------------------- orders */

export type ItemInput = { product_id: string; qty: number; unit_price: number };

function lineTotal(i: ItemInput) {
  return round2(i.qty * i.unit_price);
}

function validateOrder(s: DemoState, partyId: string, items: ItemInput[], sale: boolean) {
  const party = s.parties.find((p) => p.id === partyId);
  if (!party) throw new DemoError(400, "Party not found");
  const allowed = sale ? ["customer", "both"] : ["supplier", "both"];
  if (!allowed.includes(party.type)) throw new DemoError(400, "Choose a customer for sales or a supplier for purchases");
  if (!items.length) throw new DemoError(400, "An order needs at least one item");
  const requested = new Map<string, number>();
  for (const i of items) {
    if (!Number.isFinite(i.qty) || !Number.isFinite(i.unit_price) || i.qty <= 0 || i.unit_price < 0)
      throw new DemoError(400, "Quantity must be positive and price must not be negative");
    requested.set(i.product_id, (requested.get(i.product_id) ?? 0) + i.qty);
  }
  for (const [pid, qty] of requested) {
    const p = s.products.find((x) => x.id === pid);
    if (!p) throw new DemoError(400, "Product not found");
    if (sale && qty > p.current_stock + 1e-9) throw new DemoError(400, `Insufficient stock for ${p.name}`);
  }
  return party;
}

function reaverageCost(p: Product, qty: number, unitPrice: number) {
  const onHand = Math.max(p.current_stock, 0);
  if (onHand + qty <= 0) return;
  p.cost_price = round2((onHand * p.cost_price + qty * unitPrice) / (onHand + qty));
}

function postLedger(s: DemoState, order: Order, sale: boolean, method: string | null | undefined, by: string | null, note?: string) {
  if (!method || order.total === 0) return;
  recordEntry(s, { party_id: order.party_id, date: order.date, type: sale ? "debit" : "credit", amount: order.total,
    method: "udhaar", ref_order_id: order.id, created_by: by, note: note ?? (sale ? "Sale invoice" : "Purchase invoice") });
  if (method !== "udhaar") {
    recordEntry(s, { party_id: order.party_id, date: order.date, type: sale ? "credit" : "debit", amount: order.total,
      method, ref_order_id: order.id, created_by: by, note: "Invoice settled on posting" });
    order.status = "paid";
  }
}

export function createPurchase(s: DemoState, a: { party_id: string; date: string; items: ItemInput[];
  ledger_method?: string | null; created_by?: string | null; idempotency_key?: string | null }): Order {
  validateOrder(s, a.party_id, a.items, false);
  const order: Order = { id: newId(s, "po"), party_id: a.party_id, date: a.date, status: "received", total: 0, items: [],
    void_reason: null, idempotency_key: a.idempotency_key ?? null, created_by: a.created_by ?? null, created_at: now() };
  for (const i of a.items) {
    const p = s.products.find((x) => x.id === i.product_id)!;
    reaverageCost(p, i.qty, i.unit_price);
    order.items.push({ id: newId(s, "pi"), product_id: i.product_id, qty: i.qty, unit_price: i.unit_price,
      line_total: lineTotal(i), unit_cost: null });
    recordMovement(s, i.product_id, i.qty, "purchase", order.id, a.date);
  }
  order.total = round2(order.items.reduce((x, i) => x + i.line_total, 0));
  s.purchase_orders.push(order);
  postLedger(s, order, false, a.ledger_method, a.created_by ?? null);
  return order;
}

export function createSale(s: DemoState, a: { party_id: string; date: string; items: ItemInput[];
  ledger_method?: string | null; created_by?: string | null; idempotency_key?: string | null;
  override_credit_limit?: boolean }): Order {
  const party = validateOrder(s, a.party_id, a.items, true);
  const total = round2(a.items.reduce((x, i) => x + lineTotal(i), 0));
  let overrideNote: string | undefined;
  if (a.ledger_method === "udhaar" && party.credit_limit > 0) {
    const balance = partyBalance(s, party.id);
    if (balance + total > party.credit_limit + 0.005) {
      if (!a.override_credit_limit) {
        const message = `Credit limit exceeded for ${party.name}: balance Rs ${fmt0(balance)} + this sale Rs ${fmt0(total)} ` +
          `is over the limit of Rs ${fmt0(party.credit_limit)}. Take payment now, or ask the owner to approve an override.`;
        throw new DemoError(409, { code: "credit_limit_exceeded", message, party_name: party.name, balance,
          order_total: total, credit_limit: party.credit_limit, available: round2(Math.max(0, party.credit_limit - balance)) });
      }
      overrideNote = `Sale invoice - credit limit override approved (limit Rs ${fmt0(party.credit_limit)}, balance before Rs ${fmt0(balance)})`;
    }
  }
  const order: Order = { id: newId(s, "so"), party_id: a.party_id, date: a.date, status: "delivered", total, items: [],
    void_reason: null, idempotency_key: a.idempotency_key ?? null, created_by: a.created_by ?? null, created_at: now() };
  for (const i of a.items) {
    const p = s.products.find((x) => x.id === i.product_id)!;
    order.items.push({ id: newId(s, "si"), product_id: i.product_id, qty: i.qty, unit_price: i.unit_price,
      line_total: lineTotal(i), unit_cost: p.cost_price });
    recordMovement(s, i.product_id, -i.qty, "sale", order.id, a.date);
  }
  s.sale_orders.push(order);
  postLedger(s, order, true, a.ledger_method, a.created_by ?? null, overrideNote);
  return order;
}

export function voidOrder(s: DemoState, order: Order, sale: boolean, reason: string, by: string | null): Order {
  if (order.status === "void") throw new DemoError(409, "This order is already void");
  const date = todayIso();
  if (!sale) {
    const needed = new Map<string, number>();
    for (const i of order.items) needed.set(i.product_id, (needed.get(i.product_id) ?? 0) + i.qty);
    for (const [pid, qty] of needed) {
      const p = s.products.find((x) => x.id === pid)!;
      if (p.current_stock + 1e-9 < qty)
        throw new DemoError(409, `Cannot void: ${p.name} from this purchase has already been sold ` +
          `(in stock ${p.current_stock}, purchase ${qty})`);
    }
  }
  for (const i of order.items) {
    const p = s.products.find((x) => x.id === i.product_id)!;
    if (!sale) {
      const remaining = p.current_stock - i.qty;
      const value = p.current_stock * p.cost_price - i.qty * i.unit_price;
      if (remaining > 0 && value >= 0) p.cost_price = round2(value / remaining);
    }
    recordMovement(s, i.product_id, sale ? i.qty : -i.qty, "void", order.id, date);
  }
  for (const e of s.ledger.filter((x) => x.ref_order_id === order.id)) {
    recordEntry(s, { party_id: e.party_id, date, type: e.type === "debit" ? "credit" : "debit", amount: e.amount,
      method: e.method, ref_order_id: order.id, note: `Reversal (void): ${reason}`, created_by: by });
  }
  order.status = "void";
  order.void_reason = reason;
  return order;
}

/* ------------------------------------------------------- analytics & AI */

const activeSales = (s: DemoState) => s.sale_orders.filter((o) => o.status !== "void");

export function velocity(s: DemoState, days = 30, productId?: string, asOf = todayIso()) {
  const since = addDays(asOf, -days);
  const sold = new Map<string, number>();
  for (const o of activeSales(s)) {
    if (o.date < since || o.date > asOf) continue;
    for (const i of o.items) sold.set(i.product_id, (sold.get(i.product_id) ?? 0) + i.qty);
  }
  return s.products.filter((p) => !productId || p.id === productId).map((p) => {
    const qtySold = sold.get(p.id) ?? 0;
    const v = days > 0 ? qtySold / days : 0;
    const target = Math.max(v * (7 + 3), p.min_stock_level || 0);
    return {
      product_id: p.id, product_name: p.name, unit: p.unit, days, qty_sold: qtySold,
      velocity_per_day: Math.round(v * 1000) / 1000, current_stock: p.current_stock,
      recommended_reorder_qty: round2(Math.max(0, target - p.current_stock)),
    };
  });
}

export function profitSummary(s: DemoState, start: string, end: string) {
  let revenue = 0;
  let cost = 0;
  const byProduct: Record<string, { revenue: number; cost: number; qty: number; profit?: number }> = {};
  for (const o of activeSales(s)) {
    if (o.date < start || o.date > end) continue;
    for (const i of o.items) {
      const p = s.products.find((x) => x.id === i.product_id);
      const unitCost = i.unit_cost ?? p?.cost_price ?? 0;
      revenue += i.line_total;
      cost += i.qty * unitCost;
      const key = p?.name ?? i.product_id;
      const b = (byProduct[key] ??= { revenue: 0, cost: 0, qty: 0 });
      b.revenue += i.line_total;
      b.cost += i.qty * unitCost;
      b.qty += i.qty;
    }
  }
  for (const b of Object.values(byProduct)) b.profit = round2(b.revenue - b.cost);
  return { start, end, revenue: round2(revenue), cost: round2(cost), profit: round2(revenue - cost), by_product: byProduct };
}

export function stockAlerts(s: DemoState) {
  return s.products.filter((p) => p.current_stock < p.min_stock_level);
}

export function dashboard(s: DemoState) {
  const today = todayIso();
  const todays = activeSales(s).filter((o) => o.date === today);
  let receivables = 0;
  let payables = 0;
  const exposure: { party_id: string; party_name: string; amount: number }[] = [];
  for (const row of allBalances(s)) {
    if (row.balance > 0) {
      receivables += row.balance;
      exposure.push({ party_id: row.party_id, party_name: row.party_name, amount: row.balance });
    } else if (row.balance < 0) payables += -row.balance;
  }
  exposure.sort((a, b) => b.amount - a.amount);
  const v = velocity(s, 30);
  return {
    todays_sales_total: round2(todays.reduce((a, o) => a + o.total, 0)),
    todays_sales_count: todays.length,
    stock_alerts: stockAlerts(s).map((p) => ({ product_id: p.id, name: p.name, current_stock: p.current_stock,
      min_stock_level: p.min_stock_level, unit: p.unit })),
    total_receivables: round2(receivables),
    total_payables: round2(payables),
    top_udhaar_exposure: exposure.slice(0, 10),
    fast_movers: v.filter((x) => x.velocity_per_day > 0).sort((a, b) => b.velocity_per_day - a.velocity_per_day)
      .slice(0, 10).map((x) => ({ product_name: x.product_name, velocity_per_day: x.velocity_per_day })),
    dead_stock: v.filter((x) => x.qty_sold <= 0 && x.current_stock > 0).slice(0, 10)
      .map((x) => ({ product_name: x.product_name, current_stock: x.current_stock })),
  };
}

export function whatsappNumber(phone: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(2);
  if (d.startsWith("03") && d.length === 11) d = "92" + d.slice(1);
  return d.startsWith("92") && d.length === 12 ? d : null;
}

export function reminder(partyName: string, balance: number, overdue: number, business: string) {
  const oe = overdue > 0 ? `, of which Rs ${fmt0(overdue)} is over 30 days old` : "";
  const ou = overdue > 0 ? `, jis mein se Rs ${fmt0(overdue)} 30 din se zyada purana hai` : "";
  return {
    en: `Assalam-o-Alaikum ${partyName}. Your balance with ${business} is Rs ${fmt0(balance)}${oe}. Kindly arrange payment at your earliest convenience. JazakAllah.`,
    roman_ur: `Assalam-o-Alaikum ${partyName}. ${business} ke khata mein aap ka baqaya Rs ${fmt0(balance)} hai${ou}. Meherbani farma kar jald adaigi kar dein. JazakAllah.`,
  };
}

const WEIGHTS: Record<Bucket, number> = { current: 0.25, "30": 1, "60": 2, "90+": 3 };

export function collections(s: DemoState, asOf = todayIso()) {
  const rows = [];
  for (const party of s.parties) {
    const entries = s.ledger.filter((e) => e.party_id === party.id);
    const balance = round2(party.opening_balance + entries.reduce((a, e) => a + (e.type === "debit" ? e.amount : -e.amount), 0));
    if (balance <= 0) continue;
    const aging = ageEntries(entries, asOf);
    const aged = BUCKETS.reduce((a, b) => a + aging[b], 0);
    if (balance > aged) aging.current = round2(aging.current + balance - aged);
    else if (balance < aged) {
      let excess = aged - balance;
      for (const b of ["90+", "60", "30", "current"] as Bucket[]) {
        const applied = Math.min(aging[b], excess);
        aging[b] = round2(aging[b] - applied);
        excess -= applied;
      }
    }
    const overdue = round2(aging["30"] + aging["60"] + aging["90+"]);
    const payments = entries.filter((e) => e.type === "credit").map((e) => e.date).sort();
    const last = payments.length ? payments[payments.length - 1] : null;
    const quiet = last ? daysBetween(last, asOf) : null;
    let score = BUCKETS.reduce((a, b) => a + aging[b] * WEIGHTS[b], 0);
    const reasons: string[] = [];
    if (aging["90+"] > 0) reasons.push(`Rs ${fmt0(aging["90+"])} unpaid for 90+ days`);
    else if (aging["60"] > 0) reasons.push(`Rs ${fmt0(aging["60"])} unpaid for 60+ days`);
    else if (aging["30"] > 0) reasons.push(`Rs ${fmt0(aging["30"])} unpaid for 30+ days`);
    const overLimit = !!party.credit_limit && balance > party.credit_limit;
    if (overLimit) {
      score *= 1.25;
      reasons.push(`Over credit limit by Rs ${fmt0(balance - party.credit_limit)}`);
    }
    if (quiet === null) {
      score *= 1.1;
      reasons.push("No payment on record");
    } else if (quiet >= 30) {
      score *= 1.1;
      reasons.push(`No payment for ${quiet} days`);
    }
    if (!reasons.length) reasons.push("Balance is recent - a friendly reminder is enough");
    const number = whatsappNumber(party.phone);
    const message = reminder(party.name, balance, overdue, s.business.name);
    rows.push({
      party_id: party.id, party_name: party.name, party_name_ur: party.name_ur, phone: party.phone, balance, overdue,
      aging, credit_limit: party.credit_limit || 0, over_limit: overLimit, last_payment_date: last,
      days_since_payment: quiet, priority_score: round2(score), reasons, message,
      whatsapp_url: number ? `https://wa.me/${number}?text=${encodeURIComponent(message.roman_ur)}` : null,
      rank: 0,
    });
  }
  rows.sort((a, b) => b.priority_score - a.priority_score || b.balance - a.balance);
  rows.forEach((r, i) => (r.rank = i + 1));
  return {
    as_of: asOf,
    total_receivable: round2(rows.reduce((a, r) => a + r.balance, 0)),
    total_overdue: round2(rows.reduce((a, r) => a + r.overdue, 0)),
    customers: rows,
  };
}

export function dailySummary(s: DemoState, onDate = todayIso()) {
  const p = profitSummary(s, onDate, onDate);
  const alerts = stockAlerts(s);
  const lines = [`*${s.business.name} — Daily Summary (${onDate})*`, "", `Sales: Rs ${fmt0(p.revenue)}`,
    `Cost: Rs ${fmt0(p.cost)}`, `Profit: Rs ${fmt0(p.profit)}`, ""];
  if (alerts.length) {
    lines.push("*Stock alerts (below minimum):*");
    for (const a of alerts.slice(0, 10)) lines.push(`- ${a.name}: ${a.current_stock} ${a.unit} (min ${a.min_stock_level})`);
  } else lines.push("No stock alerts today.");
  return lines.join("\n");
}

export function statementText(s: DemoState, partyId: string) {
  const party = s.parties.find((p) => p.id === partyId);
  if (!party) throw new DemoError(404, `Party ${partyId} not found`);
  const balance = partyBalance(s, partyId);
  const aging = partyAging(s, partyId);
  const lines = [`*${s.business.name} — Statement for ${party.name}*`, "",
    `Balance: Rs ${fmt0(Math.abs(balance))} ${balance > 0 ? "(receivable)" : balance < 0 ? "(payable)" : "(settled)"}`, "", "*Aging:*"];
  for (const b of BUCKETS) if (aging[b] > 0) lines.push(`- ${b} days: Rs ${fmt0(aging[b])}`);
  return lines.join("\n");
}

/* ----------------------------------------------------- Munshi AI (offline) */

const BLOCK: Record<string, RegExp[]> = {
  tax_evasion: [/\bfake\s+invoice/i, /\btwo\s*books?\b|\bdual[- ]book/i, /\bhide\b.*\b(sales|income|revenue)\b/i, /\bavoid\s+tax\b|\btax\s+evasion\b/i],
  financial_fraud: [/\bfake\s+(receivable|udhaar|balance)/i, /\bghost\s+(inventory|stock)/i, /\binflate\b.*\b(stock|inventory|balance)\b/i, /\bfor\s+(loan|bank)\s+collateral\b/i],
  riba_advice: [/\binterest\s+rate\b.*\bcharge\b/i, /\bhow\s+much\s+interest\b.*\bcharge\b/i, /\binterest\s+rate\s+(advice|calculat)/i],
  smuggling: [/\bundeclared\s+goods\b/i, /\bsmuggl/i, /\bavoid\s+customs\b/i],
  fabricate_numbers: [/\bmake\s+up\s+a\s+number\b/i, /\bjust\s+guess\s+the\s+(total|amount|figure)\b/i],
};
const FLAG: Record<string, RegExp[]> = {
  bulk_deletion: [/\bdelete\s+all\b.*\bledger\b/i, /\bwipe\b.*\bledger\b/i],
  backdated_edit: [/\bbackdate/i, /\bchange\s+the\s+date\s+.*\bmonths?\s+ago\b/i],
  credit_limit_override: [/\boverride\s+.*\bcredit\s+limit\b/i, /\bignore\s+.*\bcredit\s+limit\b/i],
};
const BLOCK_MESSAGES: Record<string, string> = {
  tax_evasion: "I can't help with anything that fabricates invoices or hides income from tax authorities.",
  financial_fraud: "I can't fabricate receivables, inventory, or balances - that's financial fraud.",
  riba_advice: "I can report your data neutrally, but I won't advise on interest (riba) rates to charge.",
  smuggling: "I can't help with undeclared goods or customs avoidance.",
  fabricate_numbers: "I only report numbers I can actually derive from your data - I won't invent a figure.",
};

export function askMunshi(s: DemoState, question: string) {
  for (const [cat, patterns] of Object.entries(BLOCK))
    if (patterns.some((p) => p.test(question)))
      return { answer: BLOCK_MESSAGES[cat], tools_called: [] as string[], flagged: false, blocked: true };
  let flag: string | null = null;
  for (const [cat, patterns] of Object.entries(FLAG))
    if (patterns.some((p) => p.test(question))) flag = cat;

  const q = question.toLowerCase();
  let reorder = ["order", "reorder", "stock", "restock"].some((w) => q.includes(w));
  let udhaar = ["udhaar", "receivable", "owe", "credit", "aging"].some((w) => q.includes(w));
  let profit = ["profit", "p&l", "p and l", "loss", "revenue"].some((w) => q.includes(w));
  if (!(reorder || udhaar || profit)) reorder = udhaar = profit = true;
  const tools: string[] = [];
  const parts: string[] = [];
  if (reorder) {
    tools.push("get_sales_velocity");
    const list = velocity(s, 30).filter((p) => p.recommended_reorder_qty > 0);
    parts.push(list.length
      ? "Reorder suggestions (last 30 days velocity):\n" +
        list.map((p) => `- ${p.product_name}: order ~${Number(p.recommended_reorder_qty.toFixed(2))} ${p.unit}`).join("\n")
      : "Kuch bhi order karne ki zaroorat nahi - stock theek hai.");
  }
  if (udhaar) {
    tools.push("get_receivables_aging");
    const parties = s.parties.map((p) => ({ name: p.name, balance: partyBalance(s, p.id), aging: partyAging(s, p.id) }))
      .sort((a, b) => b.balance - a.balance);
    const oldest = parties.filter((p) => p.aging["90+"] > 0);
    parts.push(oldest.length
      ? `Sab se purana udhaar: ${oldest[0].name} - Rs ${fmt0(oldest[0].aging["90+"])} (90+ din).`
      : "Koi bhi udhaar 90 din se zyada purana nahi hai.");
  }
  if (profit) {
    tools.push("get_profit_summary");
    const end = todayIso();
    const p = profitSummary(s, addDays(end, -30), end);
    parts.push(`Pichlay 30 din ka profit: Rs ${fmt0(p.profit)} (revenue Rs ${fmt0(p.revenue)}).`);
  }
  let answer = parts.join("\n\n");
  if (flag) answer = `[Needs your review: This request (${flag.replace(/_/g, " ")}) needs human review before acting.]\n\n${answer}`;
  return { answer, tools_called: tools, flagged: !!flag, blocked: false };
}
