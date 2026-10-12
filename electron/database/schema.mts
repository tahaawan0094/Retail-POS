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
  {
    version: 6,
    sql: `
      CREATE TABLE user_credentials (
        user_id TEXT PRIMARY KEY REFERENCES users(id),
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        credential_version INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0,1)),
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE user_branches (
        user_id TEXT NOT NULL REFERENCES users(id),
        branch_id TEXT NOT NULL REFERENCES branches(id),
        PRIMARY KEY (user_id,branch_id)
      ) STRICT;
      CREATE TABLE login_throttle (
        username TEXT PRIMARY KEY COLLATE NOCASE,
        failed_attempts INTEGER NOT NULL,
        locked_until TEXT,
        updated_at TEXT NOT NULL
      ) STRICT;
    `,
  },
  {
    version: 7,
    sql: `
      CREATE UNIQUE INDEX idx_cash_shifts_one_open ON cash_shifts(branch_id) WHERE status='open';
      CREATE TABLE cash_shift_closings (
        shift_id TEXT PRIMARY KEY REFERENCES cash_shifts(id),
        counted_cash_paisa INTEGER NOT NULL CHECK (counted_cash_paisa >= 0),
        expected_cash_paisa INTEGER NOT NULL,
        variance_paisa INTEGER NOT NULL,
        note TEXT NOT NULL,
        closed_by TEXT NOT NULL REFERENCES users(id),
        closed_at TEXT NOT NULL,
        CHECK (variance_paisa = counted_cash_paisa - expected_cash_paisa)
      ) STRICT;
      CREATE TABLE cash_movement_notes (
        transaction_id TEXT PRIMARY KEY REFERENCES cash_transactions(id),
        reason TEXT NOT NULL,
        created_by TEXT NOT NULL REFERENCES users(id)
      ) STRICT;
      CREATE TABLE backup_metadata (
        id INTEGER PRIMARY KEY CHECK (id=1),
        format TEXT NOT NULL CHECK (format='vertexia-backup-v1'),
        created_at TEXT NOT NULL,
        app_version TEXT NOT NULL
      ) STRICT;
      INSERT INTO app_meta(key,value) VALUES ('installation_id',lower(hex(randomblob(16))));
    `,
  },
  {
    version: 8,
    sql: `
      CREATE TABLE account_document_sequences (
        branch_id TEXT NOT NULL REFERENCES branches(id),
        kind TEXT NOT NULL CHECK(kind IN ('receipt','expense','reversal')),
        business_date TEXT NOT NULL,
        last_value INTEGER NOT NULL CHECK(last_value>=0),
        PRIMARY KEY(branch_id,kind,business_date)
      ) STRICT;
      CREATE TABLE customer_receipts (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL REFERENCES branches(id),
        customer_id TEXT NOT NULL REFERENCES customers(id),
        receipt_number TEXT NOT NULL,
        business_date TEXT NOT NULL,
        customer_name_snapshot TEXT NOT NULL,
        customer_phone_snapshot TEXT NOT NULL,
        amount_paisa INTEGER NOT NULL CHECK(amount_paisa>0),
        balance_after_paisa INTEGER NOT NULL CHECK(balance_after_paisa>=0),
        method TEXT NOT NULL CHECK(method IN ('Cash','Bank Transfer','JazzCash','Easypaisa','Card')),
        reference TEXT NOT NULL,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL,
        UNIQUE(branch_id,receipt_number)
      ) STRICT;
      CREATE INDEX idx_customer_receipts_branch_customer ON customer_receipts(branch_id,customer_id,created_at DESC);
      CREATE TABLE expense_postings (
        expense_id TEXT PRIMARY KEY REFERENCES expenses(id),
        expense_number TEXT NOT NULL,
        reference TEXT NOT NULL,
        created_by TEXT NOT NULL REFERENCES users(id)
      ) STRICT;
      CREATE TABLE expense_reversals (
        id TEXT PRIMARY KEY,
        expense_id TEXT NOT NULL UNIQUE REFERENCES expenses(id),
        branch_id TEXT NOT NULL REFERENCES branches(id),
        reversal_number TEXT NOT NULL,
        business_date TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_by TEXT NOT NULL REFERENCES users(id),
        occurred_at TEXT NOT NULL,
        UNIQUE(branch_id,reversal_number)
      ) STRICT;
      CREATE INDEX idx_expense_reversals_branch_date ON expense_reversals(branch_id,business_date);
    `,
  },
  {
    version: 9,
    sql: `
      CREATE TABLE stock_values (
        branch_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        total_cost_paisa INTEGER NOT NULL CHECK(total_cost_paisa BETWEEN 0 AND 9007199254740991),
        estimated INTEGER NOT NULL CHECK(estimated IN (0,1)),
        updated_at TEXT NOT NULL,
        PRIMARY KEY(branch_id,product_id),
        FOREIGN KEY(branch_id,product_id) REFERENCES stock_levels(branch_id,product_id)
      ) STRICT;
      CREATE TABLE stock_value_movements (
        movement_id TEXT PRIMARY KEY REFERENCES stock_movements(id),
        cost_delta_paisa INTEGER NOT NULL CHECK(cost_delta_paisa BETWEEN -9007199254740991 AND 9007199254740991),
        cost_after_paisa INTEGER NOT NULL CHECK(cost_after_paisa BETWEEN 0 AND 9007199254740991),
        estimated INTEGER NOT NULL CHECK(estimated IN (0,1))
      ) STRICT;
      CREATE TABLE sale_item_costs (
        sale_item_id TEXT PRIMARY KEY REFERENCES sale_items(id),
        total_cost_paisa INTEGER NOT NULL CHECK(total_cost_paisa BETWEEN 0 AND 9007199254740991),
        estimated INTEGER NOT NULL CHECK(estimated IN (0,1))
      ) STRICT;
      INSERT INTO stock_values
        SELECT s.branch_id,s.product_id,(s.quantity_milli/1000)*p.purchase_price_paisa
          +(s.quantity_milli%1000)*(p.purchase_price_paisa/1000)
          +((s.quantity_milli%1000)*(p.purchase_price_paisa%1000)+500)/1000,
          CASE WHEN s.quantity_milli>0 THEN 1 ELSE 0 END,s.updated_at
        FROM stock_levels s JOIN products p ON p.id=s.product_id;
      INSERT INTO sale_item_costs SELECT id,(quantity_milli/1000)*unit_cost_paisa
        +(quantity_milli%1000)*(unit_cost_paisa/1000)
        +((quantity_milli%1000)*(unit_cost_paisa%1000)+500)/1000,1 FROM sale_items;
    `,
  },
  {
    version: 10,
    sql: `
      CREATE TABLE stock_transfers (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL REFERENCES businesses(id),
        source_branch_id TEXT NOT NULL REFERENCES branches(id),
        destination_branch_id TEXT NOT NULL REFERENCES branches(id),
        transfer_number TEXT NOT NULL,
        business_date TEXT NOT NULL,
        note TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('dispatched','received','cancelled')),
        dispatched_by TEXT NOT NULL REFERENCES users(id),
        dispatched_at TEXT NOT NULL,
        finished_by TEXT REFERENCES users(id),
        finished_at TEXT,
        finish_note TEXT NOT NULL DEFAULT '',
        CHECK(source_branch_id!=destination_branch_id),
        CHECK((status='dispatched' AND finished_at IS NULL AND finished_by IS NULL) OR (status!='dispatched' AND finished_at IS NOT NULL AND finished_by IS NOT NULL)),
        UNIQUE(source_branch_id,transfer_number)
      ) STRICT;
      CREATE INDEX idx_transfers_source_status ON stock_transfers(source_branch_id,status,dispatched_at);
      CREATE INDEX idx_transfers_destination_status ON stock_transfers(destination_branch_id,status,dispatched_at);
      CREATE TABLE stock_transfer_items (
        transfer_id TEXT NOT NULL REFERENCES stock_transfers(id),
        product_id TEXT NOT NULL REFERENCES products(id),
        product_name_snapshot TEXT NOT NULL,
        sku_snapshot TEXT NOT NULL,
        unit_snapshot TEXT NOT NULL,
        quantity_milli INTEGER NOT NULL CHECK(quantity_milli BETWEEN 1 AND 9007199254740991),
        cost_paisa INTEGER NOT NULL CHECK(cost_paisa BETWEEN 0 AND 9007199254740991),
        estimated INTEGER NOT NULL CHECK(estimated IN (0,1)),
        PRIMARY KEY(transfer_id,product_id)
      ) STRICT;
      CREATE TABLE transfer_document_sequences (
        branch_id TEXT NOT NULL REFERENCES branches(id),
        business_date TEXT NOT NULL,
        last_value INTEGER NOT NULL CHECK(last_value>=0),
        PRIMARY KEY(branch_id,business_date)
      ) STRICT;
      INSERT OR IGNORE INTO stock_levels
        SELECT b.id,p.id,0,p.updated_at FROM branches b JOIN products p ON p.business_id=b.business_id WHERE b.is_active=1;
      INSERT OR IGNORE INTO stock_values SELECT branch_id,product_id,0,0,updated_at FROM stock_levels WHERE quantity_milli=0;
    `,
  },
] as const
