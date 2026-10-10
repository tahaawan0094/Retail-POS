export const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS businesses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'PKR',
        timezone TEXT NOT NULL DEFAULT 'Asia/Karachi',
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        city TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        UNIQUE (business_id, code)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        sku TEXT NOT NULL,
        barcode TEXT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        brand TEXT,
        unit TEXT NOT NULL,
        visual_kind TEXT NOT NULL DEFAULT 'box',
        purchase_price_paisa INTEGER NOT NULL CHECK (purchase_price_paisa >= 0),
        selling_price_paisa INTEGER NOT NULL CHECK (selling_price_paisa >= 0),
        minimum_stock_milli INTEGER NOT NULL DEFAULT 0 CHECK (minimum_stock_milli >= 0),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (business_id, sku),
        UNIQUE (business_id, barcode)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS stock_levels (
        branch_id TEXT NOT NULL REFERENCES branches(id),
        product_id TEXT NOT NULL REFERENCES products(id),
        quantity_milli INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (branch_id, product_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL REFERENCES branches(id),
        product_id TEXT NOT NULL REFERENCES products(id),
        movement_type TEXT NOT NULL,
        quantity_delta_milli INTEGER NOT NULL,
        balance_after_milli INTEGER NOT NULL,
        reference_type TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        reason TEXT,
        occurred_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        name TEXT NOT NULL,
        phone TEXT,
        is_walk_in INTEGER NOT NULL DEFAULT 0 CHECK (is_walk_in IN (0, 1)),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS customer_ledger (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL REFERENCES branches(id),
        customer_id TEXT NOT NULL REFERENCES customers(id),
        entry_type TEXT NOT NULL,
        debit_paisa INTEGER NOT NULL DEFAULT 0 CHECK (debit_paisa >= 0),
        credit_paisa INTEGER NOT NULL DEFAULT 0 CHECK (credit_paisa >= 0),
        reference_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        name TEXT NOT NULL,
        phone TEXT,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS supplier_ledger (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL REFERENCES branches(id),
        supplier_id TEXT NOT NULL REFERENCES suppliers(id),
        entry_type TEXT NOT NULL,
        debit_paisa INTEGER NOT NULL DEFAULT 0 CHECK (debit_paisa >= 0),
        credit_paisa INTEGER NOT NULL DEFAULT 0 CHECK (credit_paisa >= 0),
        reference_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        branch_id TEXT NOT NULL REFERENCES branches(id),
        invoice_number TEXT NOT NULL,
        business_date TEXT NOT NULL,
        customer_id TEXT NOT NULL REFERENCES customers(id),
        cashier_id TEXT NOT NULL REFERENCES users(id),
        subtotal_paisa INTEGER NOT NULL CHECK (subtotal_paisa >= 0),
        discount_paisa INTEGER NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
        total_paisa INTEGER NOT NULL CHECK (total_paisa >= 0),
        cost_paisa INTEGER NOT NULL CHECK (cost_paisa >= 0),
        status TEXT NOT NULL CHECK (status IN ('completed', 'returned', 'voided')),
        completed_at TEXT NOT NULL,
        UNIQUE (branch_id, invoice_number)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL REFERENCES sales(id),
        product_id TEXT NOT NULL REFERENCES products(id),
        product_name_snapshot TEXT NOT NULL,
        quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
        unit_price_paisa INTEGER NOT NULL CHECK (unit_price_paisa >= 0),
        unit_cost_paisa INTEGER NOT NULL CHECK (unit_cost_paisa >= 0),
        discount_paisa INTEGER NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
        line_total_paisa INTEGER NOT NULL CHECK (line_total_paisa >= 0)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS sale_payments (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL REFERENCES sales(id),
        method TEXT NOT NULL,
        amount_paisa INTEGER NOT NULL CHECK (amount_paisa >= 0)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL REFERENCES branches(id),
        business_date TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        amount_paisa INTEGER NOT NULL CHECK (amount_paisa >= 0),
        payment_method TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS cash_shifts (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL REFERENCES branches(id),
        cashier_id TEXT NOT NULL REFERENCES users(id),
        opening_cash_paisa INTEGER NOT NULL CHECK (opening_cash_paisa >= 0),
        status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
        opened_at TEXT NOT NULL,
        closed_at TEXT
      ) STRICT;

      CREATE TABLE IF NOT EXISTS cash_transactions (
        id TEXT PRIMARY KEY,
        shift_id TEXT NOT NULL REFERENCES cash_shifts(id),
        branch_id TEXT NOT NULL REFERENCES branches(id),
        business_date TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
        amount_paisa INTEGER NOT NULL CHECK (amount_paisa >= 0),
        payment_method TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        branch_id TEXT REFERENCES branches(id),
        user_id TEXT REFERENCES users(id),
        event_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        description TEXT NOT NULL,
        reference TEXT,
        occurred_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales(branch_id, business_date, status);
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
      CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON expenses(branch_id, business_date);
      CREATE INDEX IF NOT EXISTS idx_customer_ledger_branch ON customer_ledger(branch_id, customer_id);
      CREATE INDEX IF NOT EXISTS idx_supplier_ledger_branch ON supplier_ledger(branch_id, supplier_id);
      CREATE INDEX IF NOT EXISTS idx_cash_transactions_shift ON cash_transactions(shift_id, business_date);
      CREATE INDEX IF NOT EXISTS idx_audit_events_branch_time ON audit_events(branch_id, occurred_at DESC);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS held_sales (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL REFERENCES branches(id),
        customer_id TEXT NOT NULL REFERENCES customers(id),
        cart_json TEXT NOT NULL,
        item_count INTEGER NOT NULL CHECK (item_count > 0),
        total_paisa INTEGER NOT NULL CHECK (total_paisa >= 0),
        held_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_held_sales_branch_time
        ON held_sales(branch_id, held_at DESC);
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE products ADD COLUMN subcategory TEXT NOT NULL DEFAULT '';
      ALTER TABLE products ADD COLUMN mrp_paisa INTEGER NOT NULL DEFAULT 0 CHECK (mrp_paisa >= 0);
      ALTER TABLE products ADD COLUMN image_data_url TEXT;
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS sale_returns (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL REFERENCES sales(id),
        branch_id TEXT NOT NULL REFERENCES branches(id),
        return_number TEXT NOT NULL,
        reason TEXT NOT NULL,
        refund_method TEXT NOT NULL,
        total_paisa INTEGER NOT NULL CHECK (total_paisa > 0),
        cost_paisa INTEGER NOT NULL CHECK (cost_paisa >= 0),
        created_by TEXT NOT NULL REFERENCES users(id),
        occurred_at TEXT NOT NULL,
        UNIQUE (branch_id, return_number)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS sale_return_items (
        id TEXT PRIMARY KEY,
        return_id TEXT NOT NULL REFERENCES sale_returns(id),
        sale_item_id TEXT NOT NULL REFERENCES sale_items(id),
        product_id TEXT NOT NULL REFERENCES products(id),
        quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
        refund_paisa INTEGER NOT NULL CHECK (refund_paisa >= 0),
        cost_paisa INTEGER NOT NULL CHECK (cost_paisa >= 0)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_sale_returns_sale ON sale_returns(sale_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sale_returns_branch ON sale_returns(branch_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sale_return_items_sale_item ON sale_return_items(sale_item_id);
    `,
  },
  {
    version: 5,
    sql: `
      CREATE TABLE operation_results (
        branch_id TEXT NOT NULL REFERENCES branches(id),
        operation_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        result_json TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        PRIMARY KEY (branch_id, operation_id)
      ) STRICT;

      CREATE TABLE document_sequences (
        branch_id TEXT NOT NULL REFERENCES branches(id),
        kind TEXT NOT NULL CHECK (kind IN ('sale','return','purchase')),
        business_date TEXT NOT NULL,
        last_value INTEGER NOT NULL CHECK (last_value >= 0),
        PRIMARY KEY (branch_id, kind, business_date)
      ) STRICT;

      CREATE TABLE purchases (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        branch_id TEXT NOT NULL REFERENCES branches(id),
        supplier_id TEXT NOT NULL REFERENCES suppliers(id),
        supplier_name_snapshot TEXT NOT NULL,
        purchase_number TEXT NOT NULL,
        supplier_invoice_number TEXT NOT NULL,
        business_date TEXT NOT NULL,
        total_paisa INTEGER NOT NULL CHECK (total_paisa > 0),
        created_at TEXT NOT NULL,
        UNIQUE (branch_id, purchase_number)
      ) STRICT;
      CREATE UNIQUE INDEX idx_purchases_supplier_invoice ON purchases(business_id,supplier_id,supplier_invoice_number COLLATE NOCASE)
        WHERE supplier_invoice_number <> '';
      CREATE INDEX idx_purchases_branch_date ON purchases(branch_id,business_date);

      CREATE TABLE purchase_items (
        id TEXT PRIMARY KEY,
        purchase_id TEXT NOT NULL REFERENCES purchases(id),
        product_id TEXT NOT NULL REFERENCES products(id),
        product_name_snapshot TEXT NOT NULL,
        quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
        unit_cost_paisa INTEGER NOT NULL CHECK (unit_cost_paisa >= 0),
        line_total_paisa INTEGER NOT NULL CHECK (line_total_paisa >= 0),
        UNIQUE (purchase_id, product_id)
      ) STRICT;

      CREATE TABLE supplier_payments (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL REFERENCES branches(id),
        supplier_id TEXT NOT NULL REFERENCES suppliers(id),
        business_date TEXT NOT NULL,
        method TEXT NOT NULL CHECK (method IN ('Cash','Bank Transfer','JazzCash','Easypaisa','Card')),
        amount_paisa INTEGER NOT NULL CHECK (amount_paisa > 0),
        reference TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX idx_supplier_payments_branch_supplier ON supplier_payments(branch_id,supplier_id);

      CREATE TABLE supplier_payment_allocations (
        payment_id TEXT NOT NULL REFERENCES supplier_payments(id),
        purchase_id TEXT NOT NULL REFERENCES purchases(id),
        amount_paisa INTEGER NOT NULL CHECK (amount_paisa > 0),
        PRIMARY KEY (payment_id, purchase_id)
      ) STRICT;
    `,
  },
] as const
