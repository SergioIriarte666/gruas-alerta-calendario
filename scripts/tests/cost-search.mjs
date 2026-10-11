import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE costs(id uuid primary key, description text, notes text, subcategory text, service_folio text, document_number text, dte_folio text, dte_rut_emisor text, supplier_id uuid, supplier_invoice_id uuid, category_id uuid, crane_id uuid, visible bool default true);
CREATE TABLE inventory_suppliers(id uuid primary key,name text,rut text);
CREATE TABLE supplier_invoices(id uuid primary key,supplier_id uuid,invoice_number text,description text,product_service_description text);
CREATE TABLE supplier_invoice_items(supplier_invoice_id uuid,product_code text,product_name text,description text);
CREATE TABLE cost_categories(id uuid primary key,name text);
CREATE TABLE cranes(id uuid primary key,brand text,model text,license_plate text);
INSERT INTO inventory_suppliers VALUES('00000000-0000-0000-0000-000000000001','Implementos S.A.','76123456-7');
INSERT INTO supplier_invoices VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','7047249','Compra de herramientas','Herramientas para trabajo');
INSERT INTO supplier_invoice_items VALUES('00000000-0000-0000-0000-000000000002','BLKCAR0020','Cadena Amarre Carga','Tensor Cadena y cinta reflectante');
INSERT INTO costs(id,description,notes,supplier_id,supplier_invoice_id) VALUES('31306b4d-0000-0000-0000-000000000000','Implementos S.A.','Despacho para grúa',null,'00000000-0000-0000-0000-000000000002');
INSERT INTO costs(id,description,visible) VALUES('00000000-0000-0000-0000-000000000099','Cadena confidencial',false);
ALTER TABLE costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY visible_costs ON costs FOR SELECT TO authenticated USING(visible);
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
`);
await db.exec(readFileSync('supabase/migrations/20261011211000_search_costs_invoice_details.sql','utf8'));
await db.exec('SET ROLE authenticated');
for(const query of ['cadenas','CADENAS','implementos cadenas','cadenas implementos','reflectantes','BLKCAR','7047249','CST-31306B4D','grua','76123456']) {
  const {rows}=await db.query('SELECT id FROM search_costs($1)',[query]);
  assert.deepEqual(rows.map(r=>r.id),['31306b4d-0000-0000-0000-000000000000'],query);
}
for(const query of ['neumaticos','implementos inexistente','%','abc),id.neq.null']) {
  assert.equal((await db.query('SELECT * FROM search_costs($1)',[query])).rows.length,0,query);
}
await db.exec('RESET ROLE; ALTER TABLE supplier_invoice_items ENABLE ROW LEVEL SECURITY; SET ROLE authenticated;');
assert.equal((await db.query("SELECT * FROM search_costs('cadenas')")).rows.length,0,'RLS de las líneas de factura también se respeta');
await db.exec('RESET ROLE; ALTER TABLE supplier_invoice_items DISABLE ROW LEVEL SECURITY;');
await db.exec("INSERT INTO costs(id,description) SELECT md5(i::text)::uuid,'Cadena de trabajo' FROM generate_series(1,1100)i;");
assert.equal((await db.query("SELECT count(*)::int as n FROM search_costs('cadenas')")).rows[0].n,1102,'sin límite fijo de 500');
await assert.rejects(db.exec("SET ROLE anon; SELECT * FROM search_costs('cadenas');"));
await db.close();
console.log('Búsqueda: factura XML, plurales, acentos, proveedor, códigos, permisos y más de 500 resultados verificados.');
