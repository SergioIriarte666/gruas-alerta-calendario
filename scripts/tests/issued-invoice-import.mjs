// Isolated PostgreSQL regression suite. No network or production database access.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
const sql = (text) => db.exec(text);
const scalar = async (query, args = []) =>
  (await db.query(query, args)).rows[0];
await sql(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('test.uid', true),''), '00000000-0000-0000-0000-000000000001')::uuid $$;
CREATE FUNCTION public.is_admin_user_safe() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.admin', true), 'true') <> 'false' $$;
CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1, '/') $$;
CREATE TYPE public.service_status AS ENUM ('completed','with_purchase_order','failed','invoiced','pending');
CREATE TYPE public.closure_status AS ENUM ('open','closed','invoiced');
CREATE TABLE clients(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rut text);
CREATE TABLE company_data(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rut text);
INSERT INTO clients VALUES ('00000000-0000-0000-0000-000000000010','77.222.333-4'),('00000000-0000-0000-0000-000000000020','78.222.333-4');
INSERT INTO company_data(rut) VALUES ('76.123.456-0');
CREATE TABLE services(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), folio text, client_id uuid, third_party_client_id uuid, service_date date DEFAULT '2026-09-01', purchase_order text DEFAULT 'OC-00821', status service_status DEFAULT 'completed', value numeric DEFAULT 100000, has_excess boolean DEFAULT false, client_covered_amount numeric, excess_amount numeric, custody_total_amount numeric, invoice_folio text, invoice_numero_fiscal text, updated_at timestamptz);
CREATE TABLE service_disputes(service_id uuid, status text);
CREATE TABLE service_closures(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), folio text UNIQUE, client_id uuid, date_from date, date_to date, total numeric, status closure_status, closure_type text, purchase_order text, created_by uuid, updated_at timestamptz);
CREATE TABLE closure_services(closure_id uuid REFERENCES service_closures, service_id uuid REFERENCES services, value_type text, amount numeric, UNIQUE(service_id,value_type));
CREATE TABLE invoices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_id uuid, folio text UNIQUE, issue_date date, due_date date, subtotal numeric, vat numeric, total numeric, status text, numero_fiscal text UNIQUE, product_service_description text, notes text, created_by uuid);
CREATE TABLE invoice_services(invoice_id uuid REFERENCES invoices, service_id uuid REFERENCES services, UNIQUE(invoice_id,service_id));
CREATE TABLE invoice_closures(invoice_id uuid REFERENCES invoices, closure_id uuid REFERENCES service_closures);
CREATE SEQUENCE invoice_seq START 4000;
CREATE FUNCTION public.generate_simple_invoice_folio() RETURNS text LANGUAGE sql AS $$ SELECT 'FACT-' || nextval('invoice_seq')::text $$;
`);
// Include actual baseline status triggers; they must not undo partial invoicing.
const baseline = await readFile(
  'supabase/migrations/00000000000000_baseline_schema.sql',
  'utf8',
);
for (const name of [
  'auto_update_service_invoice_status',
  'validate_service_invoice_consistency',
  'propagate_invoice_folio_to_closure_services',
]) {
  const start = baseline.indexOf(
    `CREATE OR REPLACE FUNCTION "public"."${name}"`,
  );
  await sql(baseline.slice(start, baseline.indexOf('$$;', start) + 3));
}
await sql(`CREATE TRIGGER auto_invoice BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION auto_update_service_invoice_status();
CREATE TRIGGER validate_invoice BEFORE INSERT OR UPDATE ON services FOR EACH ROW EXECUTE FUNCTION validate_service_invoice_consistency();
CREATE TRIGGER propagate_invoice AFTER INSERT ON invoice_closures FOR EACH ROW EXECUTE FUNCTION propagate_invoice_folio_to_closure_services();`);
await sql(
  await readFile(
    'supabase/migrations/20260922175900_add_partial_invoice_service_status.sql',
    'utf8',
  ),
);
await sql(
  await readFile(
    'supabase/migrations/20260922180000_issued_invoice_batch_import.sql',
    'utf8',
  ),
);
let counter = 0;
const fields = {
  documentType: '33',
  issuerRut: '76.123.456-0',
  clientRut: '77.222.333-4',
  fiscalNumber: '4369',
  purchaseOrder: '00821',
  issueDate: '2026-09-01',
  dueDate: '2026-09-30',
  net: 100000,
  vat: 19000,
  total: 119000,
  description: 'Servicios de traslado según OC',
};
const service = async (extra = {}) => {
  const entries = Object.entries({
    folio: `SER-${++counter}`,
    client_id: '00000000-0000-0000-0000-000000000010',
    ...extra,
  });
  return (
    await scalar(
      `INSERT INTO services(${entries.map(([k]) => k).join(',')}) VALUES(${entries.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING id`,
      entries.map(([, v]) => v),
    )
  ).id;
};
const draft = async (keys, overrides = {}, manualReason = '') => {
  const hash = (++counter).toString(16).padStart(64, '0');
  const path = `00000000-0000-0000-0000-000000000001/${hash}.pdf`;
  await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2)', [
    'issued-invoice-pdfs',
    path,
  ]);
  const data = {
    fields: { ...fields, fiscalNumber: String(5000 + counter), ...overrides },
    selectedKeys: keys,
    reviewed: true,
    manualReason,
  };
  const { doc } = await scalar(
    'SELECT save_issued_invoice_draft(NULL,$1,$2,$3,$4::jsonb) AS doc',
    [hash, 'factura.pdf', path, JSON.stringify(data)],
  );
  return doc;
};
const register = async (doc) =>
  (
    await scalar('SELECT register_issued_invoice($1,$2::jsonb) AS result', [
      doc.id,
      JSON.stringify(doc.draft),
    ])
  ).result;
const fails = async (fn, pattern) => assert.rejects(fn, pattern);
const count = async (table) =>
  Number((await scalar(`SELECT count(*) AS n FROM ${table}`)).n);
const id = await service();
const doc = await draft([id + ':covered']);
const first = await register(doc);
assert.equal(await count('invoices'), 1);
assert.equal(await count('service_closures'), 1);
assert.deepEqual(await register(doc), first);
assert.equal(await count('invoices'), 1);
assert.equal(
  (await scalar('SELECT status FROM services WHERE id=$1', [id])).status,
  'invoiced',
);
assert.equal(
  (await scalar('SELECT status FROM invoices WHERE id=$1', [first.invoiceId]))
    .status,
  'sent',
);
const duplicate = await draft([(await service()) + ':covered'], {
  fiscalNumber: doc.draft.fields.fiscalNumber,
});
await fails(() => register(duplicate), /ya está registrada/);
const disputed = await service();
await db.query("INSERT INTO service_disputes VALUES ($1,'open')", [disputed]);
await fails(
  async () => register(await draft([disputed + ':covered'])),
  /Disputa abierta/,
);
const mismatch = await service();
await fails(
  async () =>
    register(
      await draft([mismatch + ':covered'], { net: 90000, total: 109000 }),
    ),
  /no coincide/,
);
const oc = await service({ purchase_order: 'OTHER' });
await fails(
  async () => register(await draft([oc + ':covered'])),
  /OC distinta/,
);
await register(
  await draft([oc + ':covered'], {}, 'OC revisada en referencia adjunta'),
);
await fails(
  async () =>
    register(
      await draft([(await service()) + ':covered'], {
        issuerRut: '11.111.111-1',
      }),
    ),
  /RUT emisor/,
);
await fails(
  async () =>
    register(await draft([(await service()) + ':covered'], { dueDate: '' })),
  /emisión/,
);
// Force a late failure after closure creation: the whole operation must roll back.
await sql(
  "CREATE FUNCTION fail_invoice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.numero_fiscal='99999' THEN RAISE EXCEPTION 'forced failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_invoice BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION fail_invoice();",
);
const before = await count('service_closures');
const rollback = await draft([(await service()) + ':covered'], {
  fiscalNumber: '99999',
});
await fails(() => register(rollback), /forced failure/);
assert.equal(await count('service_closures'), before);
assert.equal(
  (
    await scalar('SELECT result FROM issued_invoice_imports WHERE id=$1', [
      rollback.id,
    ])
  ).result,
  null,
);
// A concurrent editor must not replace the exact draft the user approved.
const stale = await draft([(await service()) + ':covered']);
await db.query(
  "UPDATE issued_invoice_imports SET draft=jsonb_set(draft,'{manualReason}','\"Changed in another session\"') WHERE id=$1",
  [stale.id],
);
await fails(() => register(stale), /borrador cambió/);
// Covered/excess can be invoiced separately, preserving partial status after the first.
const split = await service({
  has_excess: true,
  client_covered_amount: 80000,
  excess_amount: 20000,
  third_party_client_id: '00000000-0000-0000-0000-000000000020',
});
await register(
  await draft([split + ':covered'], { net: 80000, vat: 15200, total: 95200 }),
);
assert.equal(
  (await scalar('SELECT status FROM services WHERE id=$1', [split])).status,
  'partially_invoiced',
);
await register(
  await draft([split + ':excess'], {
    clientRut: '78.222.333-4',
    net: 20000,
    vat: 3800,
    total: 23800,
  }),
);
assert.equal(
  (await scalar('SELECT status FROM services WHERE id=$1', [split])).status,
  'invoiced',
);
// Same payer, two types: create two homogeneous closures, one invoice.
const mixed = await service({
  has_excess: true,
  client_covered_amount: 80000,
  excess_amount: 20000,
  third_party_client_id: '00000000-0000-0000-0000-000000000010',
});
const mixedResult = await register(
  await draft([mixed + ':covered', mixed + ':excess']),
);
assert.equal(mixedResult.closureFolios.length, 2);
// Previous closure reuse and incomplete closure rejection.
const reuse = await service();
const c = await scalar(
  "INSERT INTO service_closures(folio,client_id,date_from,date_to,total,status,closure_type) VALUES('','00000000-0000-0000-0000-000000000010','2026-09-01','2026-09-01',100000,'closed','covered') RETURNING id,folio",
);
await db.query("INSERT INTO closure_services VALUES($1,$2,'covered',100000)", [
  c.id,
  reuse,
]);
const reused = await register(await draft([reuse + ':covered']));
assert.deepEqual(reused.closureFolios, [c.folio]);
// A prior closure cannot be partially reused, even if the selected net matches.
const wholeA = await service();
const wholeB = await service();
const whole = await scalar(
  "INSERT INTO service_closures(folio,client_id,date_from,date_to,total,status,closure_type) VALUES('','00000000-0000-0000-0000-000000000010','2026-09-01','2026-09-01',200000,'closed','covered') RETURNING id",
);
await db.query(
  "INSERT INTO closure_services VALUES($1,$2,'covered',100000),($1,$3,'covered',100000)",
  [whole.id, wholeA, wholeB],
);
await fails(
  async () => register(await draft([wholeA + ':covered'])),
  /debe estar completo/,
);
assert.equal(
  (await scalar("SELECT normalize_import_oc('OCEANO') AS oc")).oc,
  'OCEANO',
);
const explicit = await scalar("INSERT INTO service_closures(folio) VALUES('CIE-950') RETURNING folio");
assert.equal(explicit.folio, 'CIE-950');
// Folio counter must never truncate 1000 to 100.
await sql("SELECT setval('service_closure_folio_seq',1000,false)");
const next = await register(await draft([(await service()) + ':covered']));
assert.equal(next.closureFolios[0], 'CIE-1000');
await sql("SET test.admin='false'");
await fails(() => register(doc), /Solo administradores/);
await fails(
  () => scalar("SELECT issued_invoice_candidates('77.222.333-4')"),
  /Solo administradores/,
);
assert.equal(
  (
    await scalar(
      "SELECT has_function_privilege('anon','public.register_issued_invoice(uuid,jsonb)','EXECUTE') AS allowed",
    )
  ).allowed,
  false,
);
console.log(
  'PASS: SQL migration, atomic registration, idempotency, duplicates, disputes, amounts, OC, dates, issuer, rollback, covered/excess, multiple closures, reuse, folios and permissions.',
);
await db.close();
