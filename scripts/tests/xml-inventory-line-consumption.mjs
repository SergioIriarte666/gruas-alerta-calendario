import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
await db.exec(`
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TYPE app_role AS ENUM ('admin', 'operator');
CREATE FUNCTION has_role(uuid, app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.authorized', true), 'true') = 'true' $$;
CREATE TABLE cranes(id uuid PRIMARY KEY);
CREATE TABLE inventory_items(id uuid PRIMARY KEY, name text, unit_cost numeric);
CREATE TABLE inventory_locations(id uuid PRIMARY KEY, code text, entity text, is_active boolean, created_at timestamptz);
CREATE TABLE cost_categories(id uuid PRIMARY KEY, name text, description text);
CREATE TABLE supplier_invoices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), supplier_id uuid, invoice_number text, issue_date date, due_date date, amount numeric, net_amount numeric, tax_amount numeric, currency text, description text, product_service_description text, status text, paid_amount numeric, source_module text, xml_file_name text);
CREATE TABLE costs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), amount numeric, category_id uuid, date date, description text, notes text, document_type text, document_number text, crane_id uuid, operator_id uuid, immediate_consumption boolean, payment_date date, service_id uuid, supplier_id uuid, supplier_invoice_id uuid, cost_center_id uuid, service_folio text, subcategory text, created_by uuid, supplier_payment_id uuid, inventory_movement_id uuid, purchase_quantity integer, purchase_unit_cost numeric, entity text, paid_by text);
CREATE TABLE supplier_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cost_id uuid UNIQUE, supplier_invoice_id uuid, reference_number text, category text, subcategory text, crane_id uuid, add_to_inventory boolean, part_name text);
CREATE TABLE supplier_invoice_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), supplier_invoice_id uuid REFERENCES supplier_invoices, inventory_item_id uuid REFERENCES inventory_items, line_number integer, product_code text, product_name text, description text, quantity integer, unit_price numeric, subtotal numeric, tax_rate numeric, tax_amount numeric, total_amount numeric, created_by uuid, movement_id uuid);
CREATE TABLE inventory_movements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid REFERENCES inventory_items, location_id uuid, movement_type text, quantity integer, unit_cost numeric, total_cost numeric, supplier_id uuid, supplier_name text, reference_document text, observations text, supplier_invoice_id uuid, supplier_invoice_item_id uuid, cost_id uuid, status text, created_by uuid, crane_id uuid, movement_date timestamptz);
CREATE TABLE crane_parts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), crane_id uuid, part_name text, date date, quantity integer, unit_price numeric, supplier text, supplier_id uuid, notes text, cost_id uuid, inventory_movement_id uuid UNIQUE, created_by uuid);
CREATE FUNCTION test_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payment_id uuid;
BEGIN
  INSERT INTO supplier_payments(cost_id) VALUES(NEW.id) RETURNING id INTO payment_id;
  UPDATE costs SET supplier_payment_id = payment_id WHERE id = NEW.id;
  RETURN NEW;
END $$;
CREATE TRIGGER payment AFTER INSERT ON costs FOR EACH ROW EXECUTE FUNCTION test_payment();
INSERT INTO cranes VALUES ('00000000-0000-0000-0000-000000000010'), ('00000000-0000-0000-0000-000000000011');
INSERT INTO inventory_items VALUES ('00000000-0000-0000-0000-000000000020', 'Patín', 10), ('00000000-0000-0000-0000-000000000021', 'Pilas', 0), ('00000000-0000-0000-0000-000000000022', 'Probador', 10);
INSERT INTO inventory_locations VALUES ('00000000-0000-0000-0000-000000000030', 'MAIN', 'gruas_5_norte', true, now());
INSERT INTO cost_categories VALUES ('00000000-0000-0000-0000-000000000040', 'Inventario', 'Compras');
`);

const baseline = await readFile('supabase/migrations/00000000000000_baseline_schema.sql', 'utf8');
const start = baseline.indexOf('CREATE OR REPLACE FUNCTION "public"."sync_inventory_exit_to_crane_parts"');
await db.exec(baseline.slice(start, baseline.indexOf('$_$;', start) + 4));
const sync = await readFile('supabase/migrations/20260715183000_lowboy_inventory_intercompany.sql', 'utf8');
const syncStart = sync.indexOf('CREATE OR REPLACE FUNCTION public.sync_inventory_to_supplier_and_cost()');
await db.exec(sync.slice(syncStart, sync.indexOf('$$;', syncStart) + 3));
await db.exec(`
CREATE TRIGGER trace AFTER INSERT OR UPDATE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION sync_inventory_exit_to_crane_parts();
CREATE TRIGGER cost_sync AFTER INSERT ON inventory_movements FOR EACH ROW EXECUTE FUNCTION sync_inventory_to_supplier_and_cost();
`);
await db.exec(await readFile('supabase/migrations/20261018170000_xml_inventory_line_consumption.sql', 'utf8'));

const crane = '00000000-0000-0000-0000-000000000010';
const otherCrane = '00000000-0000-0000-0000-000000000011';
const lines = [4, 1, 1].map((quantity, index) => ({
  line_number: index + 1, inventory_item_id: `00000000-0000-0000-0000-00000000002${index}`,
  description: ['Patín', 'Pilas', 'Probador'][index], quantity, unit_price: 100, subtotal: quantity * 100,
  tax_rate: 19, tax_amount: quantity * 19, total_amount: quantity * 119,
  consumption_quantity: index < 2 ? quantity : 0, consumption_crane_id: index < 2 ? crane : null,
}));
let sequence = 0;
async function importInvoice(items = lines, selectedCrane = crane, paid = false) {
  const args = [
    '00000000-0000-0000-0000-000000000050', String(++sequence), '2026-10-18', null,
    714, 600, 114, 'CLP', 'Factura', 'Compra de prueba', 'Compra de prueba', 'test.xml', paid,
    '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000040',
    'Inventario', null, selectedCrane, null, null, null, null, JSON.stringify(items),
  ];
  return (await db.query(`SELECT import_xml_inventory_invoice(${args.map((_, index) => '$' + (index + 1)).join(',')}) AS result`, args)).rows[0].result;
}
async function movements(invoiceId) {
  return (await db.query('SELECT movement_type, quantity, total_cost, crane_id, cost_id, supplier_invoice_item_id FROM inventory_movements WHERE supplier_invoice_id=$1 ORDER BY movement_type, quantity', [invoiceId])).rows;
}
const result = await importInvoice();
const mixed = await movements(result.invoice_id);
assert.equal(mixed.filter(row => row.movement_type === 'entry').length, 3);
assert.equal(mixed.filter(row => row.movement_type === 'exit').length, 2);
assert.ok(mixed.every(row => row.cost_id === result.cost_id));
assert.equal((await db.query('SELECT count(*)::integer AS count FROM costs')).rows[0].count, 1);
assert.equal((await db.query('SELECT count(*)::integer AS count FROM supplier_payments')).rows[0].count, 1);
assert.equal((await db.query('SELECT count(*)::integer AS count FROM crane_parts')).rows[0].count, 2);
assert.equal((await db.query('SELECT crane_id FROM costs WHERE id=$1', [result.cost_id])).rows[0].crane_id, null);
assert.equal((await db.query('SELECT amount FROM supplier_invoices WHERE id=$1', [result.invoice_id])).rows[0].amount, '714');
assert.deepEqual((await db.query("SELECT sum(CASE WHEN movement_type='entry' THEN quantity ELSE -quantity END)::integer AS balance FROM inventory_movements WHERE supplier_invoice_id=$1 GROUP BY item_id ORDER BY item_id", [result.invoice_id])).rows.map(row => row.balance), [0, 0, 1]);

const partial = await importInvoice(lines.map((line, index) => ({ ...line, consumption_quantity: index === 0 ? 2 : line.consumption_quantity, consumption_crane_id: index === 1 ? otherCrane : line.consumption_crane_id })));
const exits = (await movements(partial.invoice_id)).filter(row => row.movement_type === 'exit');
assert.deepEqual(exits.map(row => row.quantity), [1, 2]);
assert.equal(exits.find(row => row.quantity === 2).total_cost, '200.0000000000000000');
assert.equal(exits.find(row => row.quantity === 1).crane_id, otherCrane);
assert.deepEqual((await db.query("SELECT sum(CASE WHEN movement_type='entry' THEN quantity ELSE -quantity END)::integer AS balance FROM inventory_movements WHERE supplier_invoice_id=$1 GROUP BY item_id ORDER BY item_id", [partial.invoice_id])).rows.map(row => row.balance), [2, 0, 1]);
assert.ok((await db.query("SELECT (movement_date AT TIME ZONE 'America/Santiago')::date::text AS date FROM inventory_movements WHERE supplier_invoice_id=$1", [partial.invoice_id])).rows.every(row => row.date === '2026-10-18'));

const storeOnly = await importInvoice(lines.map(line => ({ ...line, consumption_quantity: 0, consumption_crane_id: null })));
assert.ok((await movements(storeOnly.invoice_id)).every(row => row.movement_type === 'entry'));
const consumeAll = await importInvoice(lines.map(line => ({ ...line, consumption_quantity: line.quantity, consumption_crane_id: crane })), crane, true);
assert.equal((await movements(consumeAll.invoice_id)).length, 6);
assert.equal((await db.query('SELECT crane_id FROM costs WHERE id=$1', [consumeAll.cost_id])).rows[0].crane_id, crane);
assert.equal((await db.query('SELECT status FROM supplier_invoices WHERE id=$1', [consumeAll.invoice_id])).rows[0].status, 'paid');

for (const invalid of [-1, 5, 1.5, null]) {
  await assert.rejects(importInvoice(lines.map((line, index) => index === 0 ? { ...line, consumption_quantity: invalid } : line)), /Cantidad a consumir inválida/);
}
await assert.rejects(importInvoice(lines.map((line, index) => index === 0 ? { ...line, consumption_crane_id: null } : line)), /grúa válida/);
await assert.rejects(importInvoice(lines.map((line, index) => index === 1 ? { ...line, inventory_item_id: '00000000-0000-0000-0000-000000000099' } : line)), /foreign key/);
assert.equal((await db.query('SELECT count(*)::integer AS count FROM supplier_invoices')).rows[0].count, 4);
await assert.rejects(db.query('UPDATE costs SET crane_id=$1, immediate_consumption=true WHERE id=$2', [crane, result.cost_id]), /destinos por producto/);
await db.query('UPDATE costs SET description=$1 WHERE id=$2', ['Glosa corregida', result.cost_id]);
assert.equal((await movements(result.invoice_id)).length, 5);
const legacy = await importInvoice(lines.map(({ consumption_quantity, consumption_crane_id, ...line }) => line));
assert.equal((await movements(legacy.invoice_id)).length, 6);
await db.exec("SET test.authorized = 'false'");
await assert.rejects(importInvoice(), /No autorizado/);
await db.close();
console.log('XML inventory: mixed destinations, partial quantities, multiple cranes, payment, atomic rollback, cost protection and legacy compatibility passed.');
