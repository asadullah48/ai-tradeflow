/**
 * The browser demo's dataset: a port of backend/seed.py. A Jodia Bazaar
 * (Karachi) general-goods wholesaler with 20 SKUs, 6 suppliers and 14
 * customers, and 90 days of trade ending today — posted through the same
 * engine rules the demo uses afterwards (weighted-average cost, credit
 * limits, supplier terms), so every number on screen is derived, not typed.
 * All businesses and people are fictional.
 */
import { addDays, createPurchase, createSale, partyBalance, recordEntry, todayIso, type DemoState, type Order } from "./engine";

export const DEMO_VERSION = 4;

const CATALOG: [string, string, string, string, number, number][] = [
  ["Steel Rod 12mm", "سٹیل راڈ 12mm", "hardware", "piece", 480, 620],
  ["Cement Bag 50kg", "سیمنٹ بوری 50kg", "hardware", "piece", 950, 1080],
  ["PVC Pipe 4inch", "پی وی سی پائپ", "hardware", "piece", 320, 410],
  ["Wire Roll 100m", "تار رول", "hardware", "piece", 1800, 2150],
  ["Paint Bucket 20L", "پینٹ بالٹی", "hardware", "piece", 3200, 3800],
  ["Nails Box 5kg", "کیلوں کا ڈبہ", "hardware", "carton", 650, 800],
  ["Tarpaulin Sheet", "ترپال", "textile", "piece", 400, 520],
  ["Cotton Cloth Bale", "روئی کپڑا گٹھڑی", "textile", "piece", 4500, 5400],
  ["School Bag", "سکول بیگ", "general", "piece", 350, 480],
  ["Plastic Chair", "پلاسٹک کرسی", "general", "piece", 850, 1050],
  ["Tea Cup Set", "چائے کپ سیٹ", "general", "dozen", 600, 780],
  ["Rice Bag 25kg", "چاول بوری 25kg", "grocery", "piece", 4200, 4650],
  ["Cooking Oil Tin 16L", "کوکنگ آئل ٹن", "grocery", "piece", 7800, 8600],
  ["Sugar Bag 50kg", "چینی بوری", "grocery", "piece", 8500, 9200],
  ["Flour Bag 20kg", "آٹا بوری", "grocery", "piece", 2400, 2750],
  ["LED Bulb 12W", "ایل ای ڈی بلب", "electrical", "dozen", 900, 1200],
  ["Extension Cord 5m", "توسیعی تار", "electrical", "piece", 380, 490],
  ["Ceiling Fan", "چھت کا پنکھا", "electrical", "piece", 2800, 3400],
  ["Water Pump 1HP", "پانی کا پمپ", "electrical", "piece", 8500, 9800],
  ["Rubber Hose 50ft", "ربڑ ہوز", "hardware", "piece", 1200, 1500],
];
const SUPPLIERS: [string, string][] = [
  ["Al-Karam Traders", "الکرم ٹریڈرز"], ["Habib Wholesale House", "حبیب ہول سیل ہاؤس"],
  ["Zubair Brothers", "زبیر برادرز"], ["Metro Supply Co", "میٹرو سپلائی کمپنی"],
  ["Sindh Traders", "سندھ ٹریڈرز"], ["Jodia Bazaar Depot", "جوڑیا بازار ڈپو"],
];
const CUSTOMERS: [string, string][] = [
  ["Rehman Store", "رحمان اسٹور"], ["Bilal General Store", "بلال جنرل اسٹور"],
  ["Al-Madina Traders", "المدینہ ٹریڈرز"], ["Noor Enterprises", "نور انٹرپرائزز"],
  ["Karim Brothers", "کریم برادرز"], ["City Hardware", "سٹی ہارڈویئر"],
  ["Faisal Store", "فیصل اسٹور"], ["New Light Traders", "نیو لائٹ ٹریڈرز"],
  ["Hussain & Sons", "حسین اینڈ سنز"], ["Shah Trading Co", "شاہ ٹریڈنگ کمپنی"],
  ["Prime Wholesale", "پرائم ہول سیل"], ["Elite Store", "ایلیٹ اسٹور"],
  ["Continental Traders", "کانٹینینٹل ٹریڈرز"], ["Sunrise Enterprises", "سن رائز انٹرپرائزز"],
];
const CITIES = ["Karachi", "Lahore", "Hyderabad", "Sukkur", "Faisalabad"];

/** mulberry32 — small deterministic PRNG so every visitor gets the same books. */
function rng(seed: number) {
  let a = seed;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T,>(xs: T[]) => xs[Math.floor(next() * xs.length)],
    sample: <T,>(xs: T[], k: number) => {
      const copy = [...xs];
      const out: T[] = [];
      for (let i = 0; i < k && copy.length; i++) out.push(copy.splice(Math.floor(next() * copy.length), 1)[0]);
      return out;
    },
    uniform: (lo: number, hi: number) => lo + next() * (hi - lo),
  };
}

export function buildDemoState(): DemoState {
  const r = rng(42);
  const today = todayIso();
  const start = addDays(today, -90);
  const stamp = new Date().toISOString();
  const s: DemoState = {
    version: DEMO_VERSION,
    seeded_on: today,
    business: { id: "demo-business", name: "Jodia Bazaar Traders (demo)", city: "Karachi" },
    users: [
      { id: "demo-owner", name: "Demo Owner", phone: "03000000000", role: "owner", password: "tradeflow123" },
      { id: "demo-munshi", name: "Demo Munshi", phone: "03000000001", role: "munshi", password: "tradeflow123" },
    ],
    parties: [], products: [], purchase_orders: [], sale_orders: [], ledger: [], movements: [], seq: 0,
  };
  const owner = "demo-owner";

  CATALOG.forEach(([name, name_ur, category, unit, cost, sale], i) => {
    s.products.push({ id: `prod-${String(i + 1).padStart(2, "0")}`, sku: `SKU-${String(i + 1).padStart(3, "0")}`, name,
      name_ur, category, unit, cost_price: cost, sale_price: sale, min_stock_level: r.int(20, 80), current_stock: 0,
      created_at: stamp });
  });
  SUPPLIERS.forEach(([name, name_ur], i) => {
    s.parties.push({ id: `sup-${i + 1}`, name, name_ur, type: "supplier", city: r.pick(CITIES),
      phone: `0321${String(i).padStart(7, "0")}`, credit_limit: 0, opening_balance: 0, created_at: stamp });
  });
  CUSTOMERS.forEach(([name, name_ur], i) => {
    s.parties.push({ id: `cus-${String(i + 1).padStart(2, "0")}`, name, name_ur, type: "customer", city: r.pick(CITIES),
      phone: `0300${String(i + 2).padStart(7, "0")}`, credit_limit: r.pick([0, 50000, 100000, 200000]),
      opening_balance: 0, created_at: stamp });
  });
  const suppliers = s.parties.filter((p) => p.type === "supplier");
  const customers = s.parties.filter((p) => p.type === "customer");
  const bills: Order[] = [];

  for (const p of s.products) {
    const o = createPurchase(s, { party_id: r.pick(suppliers).id, date: start, created_by: owner,
      items: [{ product_id: p.id, qty: r.int(30, 120), unit_price: p.cost_price }],
      ledger_method: r.pick(["bank", "bank", "udhaar"]) });
    if (o.status !== "paid") bills.push(o);
  }

  const fast = r.sample(s.products, 6);
  const restockDays = new Map(fast.map((p) => [p.id, r.int(30, 60)]));
  for (let day = 0; day <= 90; day++) {
    const date = addDays(start, day);
    for (const p of fast) {
      if (restockDays.get(p.id) === day) {
        // Mid-period restock of a fast mover, at a slightly different price:
        // this is what makes the weighted-average cost move.
        createPurchase(s, { party_id: r.pick(suppliers).id, date, created_by: owner, ledger_method: "bank",
          items: [{ product_id: p.id, qty: r.int(100, 300), unit_price: Math.round(p.cost_price * r.uniform(0.97, 1.06)) }] });
      }
    }
    const count = r.int(1, 4);
    for (let n = 0; n < count; n++) {
      const customer = r.pick(customers);
      const chosen = r.next() < 0.6 ? r.sample(fast, r.int(1, 2)) : r.sample(s.products, 1);
      const items = chosen.map((p) => ({ product_id: p.id, qty: r.int(1, 8), unit_price: p.sale_price }));
      for (const it of items) {
        const p = s.products.find((x) => x.id === it.product_id)!;
        if (p.current_stock < it.qty) {
          const bill = createPurchase(s, { party_id: r.pick(suppliers).id, date, created_by: owner, ledger_method: "udhaar",
            items: [{ product_id: p.id, qty: r.int(40, 80), unit_price: p.cost_price }] });
          bills.push(bill);
        }
      }
      let onCredit = r.next() < 0.4;
      if (onCredit && customer.credit_limit) {
        const total = items.reduce((a, i) => a + i.qty * i.unit_price, 0);
        if (partyBalance(s, customer.id) + total > customer.credit_limit) onCredit = false;
      }
      const sale = createSale(s, { party_id: customer.id, date, items, created_by: owner,
        ledger_method: onCredit ? "udhaar" : r.pick(["cash", "cash", "jazzcash", "easypaisa", "bank"]) });
      const payDate = addDays(date, r.int(5, 60));
      // A payment scheduled after today simply hasn't happened yet.
      if (onCredit && r.next() < 0.5 && payDate <= today) {
        recordEntry(s, { party_id: customer.id, date: payDate, type: "credit",
          amount: Math.round(sale.total * r.uniform(0.3, 1) * 100) / 100, created_by: owner,
          method: r.pick(["cash", "bank", "jazzcash", "easypaisa"]), note: "Payment received" });
      }
    }
  }

  for (const bill of bills) {
    const payDate = addDays(bill.date, r.int(15, 45));
    if (payDate <= today && r.next() < 0.9)
      recordEntry(s, { party_id: bill.party_id, date: payDate, type: "debit", amount: bill.total, method: "bank",
        note: "Supplier payment", created_by: owner });
  }
  return s;
}
