"""Seed script - realistic demo dataset for TradeFlow (SPEC §8, Session 4).

Persona: a general-goods wholesaler (Jodia Bazaar-style, Karachi) - Open
Decision #4 resolved this way since the spices persona depended on the
unavailable Masala Store domain.

Run with: python seed.py   (from backend/, with the venv active)
"""

import random
from datetime import date, timedelta

from app.auth.security import hash_password
from app.database import Base, SessionLocal, engine
from app.models.business import Business
from app.models.party import Party
from app.models.product import Product
from app.models.user import User
from app.services import ledger_service, order_service
from app.tenancy import scope_session

random.seed(42)

PRODUCT_CATALOG = [
    ("Steel Rod 12mm", "سٹیل راڈ 12mm", "hardware", "piece", 480, 620),
    ("Cement Bag 50kg", "سیمنٹ بوری 50kg", "hardware", "piece", 950, 1080),
    ("PVC Pipe 4inch", "پی وی سی پائپ", "hardware", "piece", 320, 410),
    ("Wire Roll 100m", "تار رول", "hardware", "piece", 1800, 2150),
    ("Paint Bucket 20L", "پینٹ بالٹی", "hardware", "piece", 3200, 3800),
    ("Nails Box 5kg", "کیلوں کا ڈبہ", "hardware", "carton", 650, 800),
    ("Tarpaulin Sheet", "ترپال", "textile", "piece", 400, 520),
    ("Cotton Cloth Bale", "روئی کپڑا گٹھڑی", "textile", "piece", 4500, 5400),
    ("School Bag", "سکول بیگ", "general", "piece", 350, 480),
    ("Plastic Chair", "پلاسٹک کرسی", "general", "piece", 850, 1050),
    ("Tea Cup Set", "چائے کپ سیٹ", "general", "dozen", 600, 780),
    ("Rice Bag 25kg", "چاول بوری 25kg", "grocery", "piece", 4200, 4650),
    ("Cooking Oil Tin 16L", "کوکنگ آئل ٹن", "grocery", "piece", 7800, 8600),
    ("Sugar Bag 50kg", "چینی بوری", "grocery", "piece", 8500, 9200),
    ("Flour Bag 20kg", "آٹا بوری", "grocery", "piece", 2400, 2750),
    ("LED Bulb 12W", "ایل ای ڈی بلب", "electrical", "dozen", 900, 1200),
    ("Extension Cord 5m", "توسیعی تار", "electrical", "piece", 380, 490),
    ("Ceiling Fan", "چھت کا پنکھا", "electrical", "piece", 2800, 3400),
    ("Water Pump 1HP", "پانی کا پمپ", "electrical", "piece", 8500, 9800),
    ("Rubber Hose 50ft", "ربڑ ہوز", "hardware", "piece", 1200, 1500),
]

SUPPLIER_NAMES = [
    ("Al-Karam Traders", "الکرم ٹریڈرز"), ("Habib Wholesale House", "حبیب ہول سیل ہاؤس"),
    ("Zubair Brothers", "زبیر برادرز"), ("Metro Supply Co", "میٹرو سپلائی کمپنی"),
    ("Sindh Traders", "سندھ ٹریڈرز"), ("Jodia Bazaar Depot", "جوڑیا بازار ڈپو"),
]

CUSTOMER_NAMES = [
    ("Rehman Store", "رحمان اسٹور"), ("Bilal General Store", "بلال جنرل اسٹور"),
    ("Al-Madina Traders", "المدینہ ٹریڈرز"), ("Noor Enterprises", "نور انٹرپرائزز"),
    ("Karim Brothers", "کریم برادرز"), ("City Hardware", "سٹی ہارڈویئر"),
    ("Faisal Store", "فیصل اسٹور"), ("New Light Traders", "نیو لائٹ ٹریڈرز"),
    ("Hussain & Sons", "حسین اینڈ سنز"), ("Shah Trading Co", "شاہ ٹریڈنگ کمپنی"),
    ("Prime Wholesale", "پرائم ہول سیل"), ("Elite Store", "ایلیٹ اسٹور"),
    ("Continental Traders", "کانٹینینٹل ٹریڈرز"), ("Sunrise Enterprises", "سن رائز انٹرپرائزز"),
]

CITIES = ["Karachi", "Lahore", "Hyderabad", "Sukkur", "Faisalabad"]


def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def seed():
    reset_db()
    db = SessionLocal()

    business = Business(name="Jodia Bazaar Traders (demo)", city="Karachi")
    db.add(business)
    db.flush()
    # Every row below is stamped with this business, exactly as the API does.
    scope_session(db, business.id)

    owner = User(name="Demo Owner", phone="03000000000", role="owner", password_hash=hash_password("tradeflow123"))
    munshi = User(name="Demo Munshi", phone="03000000001", role="munshi", password_hash=hash_password("tradeflow123"))
    db.add_all([owner, munshi])

    products = []
    for name, name_ur, category, unit, cost, sale in PRODUCT_CATALOG:
        p = Product(
            sku=f"SKU-{len(products) + 1:03d}", name=name, name_ur=name_ur, category=category,
            unit=unit, cost_price=cost, sale_price=sale, min_stock_level=random.randint(20, 80), current_stock=0,
        )
        products.append(p)
        db.add(p)

    suppliers = [Party(name=n, name_ur=u, type="supplier", city=random.choice(CITIES), phone=f"0321{i:07d}") for i, (n, u) in enumerate(SUPPLIER_NAMES)]
    customers = [Party(name=n, name_ur=u, type="customer", city=random.choice(CITIES), credit_limit=random.choice([0, 50000, 100000, 200000]), phone=f"0300{i:07d}") for i, (n, u) in enumerate(CUSTOMER_NAMES)]
    db.add_all(suppliers + customers)
    db.flush()

    today = date.today()
    start = today - timedelta(days=90)

    supplier_bills = []  # udhaar purchases, paid on terms at the end

    # Initial stock-up: every product gets an opening purchase.
    for product in products:
        supplier = random.choice(suppliers)
        qty = random.randint(30, 120)
        opening = order_service.create_purchase_order(db, party_id=supplier.id, order_date=start, items=[{"product_id": product.id, "qty": qty, "unit_price": product.cost_price}], ledger_method=random.choice(["bank", "bank", "udhaar"]), created_by=owner.id)
        if opening.status != "paid":
            supplier_bills.append(opening)

    # 90 days of sales activity - fast movers sell often, some products barely move (dead stock).
    fast_movers = random.sample(products, 6)
    for day_offset in range(90):
        order_date = start + timedelta(days=day_offset)
        num_sales = random.randint(1, 4)
        for _ in range(num_sales):
            customer = random.choice(customers)
            chosen_products = random.sample(fast_movers, k=random.randint(1, 2)) if random.random() < 0.6 else random.sample(products, k=1)
            items = [{"product_id": p.id, "qty": random.randint(1, 8), "unit_price": p.sale_price} for p in chosen_products]
            # Replenish before a sale; never invent negative stock in demo data.
            for item in items:
                product = next(p for p in products if p.id == item["product_id"])
                if product.current_stock < item["qty"]:
                    supplier = random.choice(suppliers)
                    restock = order_service.create_purchase_order(db, party_id=supplier.id,
                        order_date=order_date, items=[{"product_id": product.id, "qty": random.randint(40, 80),
                        "unit_price": product.cost_price}], ledger_method="udhaar", created_by=owner.id)
                    supplier_bills.append(restock)
            on_credit = random.random() < 0.4
            if on_credit and customer.credit_limit:
                # Respect the credit limit the same way the API does: over the
                # limit, the shop takes cash instead of extending more udhaar.
                total = sum(i["qty"] * i["unit_price"] for i in items)
                if ledger_service.get_party_balance(db, customer.id) + total > customer.credit_limit:
                    on_credit = False
            sale = order_service.create_sale_order(db, party_id=customer.id, order_date=order_date,
                items=items, ledger_method="udhaar" if on_credit else "cash", created_by=owner.id)

            # Cash settles immediately; credit invoices remain outstanding.
            if on_credit:
                # Some udhaar gets partially paid back later.
                if random.random() < 0.5:
                    payment_date = min(order_date + timedelta(days=random.randint(5, 60)), today)
                    ledger_service.record_entry(db, party_id=customer.id, entry_date=payment_date, entry_type="credit", amount=round(sale.total * random.uniform(0.3, 1.0), 2), method=random.choice(["cash", "bank", "jazzcash", "easypaisa"]), created_by=owner.id)

    # A couple of restocks partway through, for the fast movers.
    for product in fast_movers:
        supplier = random.choice(suppliers)
        restock_date = start + timedelta(days=random.randint(30, 60))
        order_service.create_purchase_order(db, party_id=supplier.id, order_date=restock_date, items=[{"product_id": product.id, "qty": random.randint(100, 300), "unit_price": product.cost_price}], ledger_method="bank", created_by=owner.id)

    # Suppliers are paid on 15-45 day terms, by bank; recent bills stay open.
    for bill in supplier_bills:
        pay_date = bill.date + timedelta(days=random.randint(15, 45))
        if pay_date <= today and random.random() < 0.9:
            ledger_service.record_entry(db, party_id=bill.party_id, entry_date=pay_date, entry_type="debit",
                amount=bill.total, method="bank", note="Supplier payment", created_by=owner.id)

    db.commit()
    db.close()

    print(f"Seeded: {len(products)} products, {len(suppliers)} suppliers, {len(customers)} customers, 90 days of transactions.")
    print("Owner login:  phone=03000000000  password=tradeflow123")
    print("Munshi login: phone=03000000001  password=tradeflow123")


if __name__ == "__main__":
    seed()
