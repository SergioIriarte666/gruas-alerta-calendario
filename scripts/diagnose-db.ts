
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables manually
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let value = parts.slice(1).join('=').trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && value) {
        process.env[key] = value;
      }
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY/VITE_SUPABASE_PUBLISHABLE_KEY not found in environment variables.');
  console.log('Available keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('Starting database diagnosis...');
  console.log(`Connecting to Supabase at ${supabaseUrl}`);

  // 1. Check if 'suppliers' table exists and is accessible
  console.log('\nChecking "suppliers" table...');
  const { data: suppliers, error: suppliersError } = await supabase
    .from('suppliers')
    .select('count', { count: 'exact', head: true });

  if (suppliersError) {
    console.error('❌ Error accessing "suppliers" table:', suppliersError.message);
  } else {
    console.log(`✅ "suppliers" table accessible. Count: ${suppliers?.length ?? 'N/A'}`);
  }

  // 2. Check if 'supplier_invoices' table exists and is accessible
  console.log('\nChecking "supplier_invoices" table...');
  const { data: invoices, error: invoicesError } = await supabase
    .from('supplier_invoices')
    .select('count', { count: 'exact', head: true });

  if (invoicesError) {
    console.error('❌ Error accessing "supplier_invoices" table:', invoicesError.message);
  } else {
    console.log(`✅ "supplier_invoices" table accessible. Count: ${invoices?.length ?? 'N/A'}`);
  }

  // 3. Check for Foreign Key relationship
  console.log('\nChecking Foreign Key relationship (supplier_invoices -> suppliers)...');
  // We try a select with join. If FK is missing, this will fail.
  const { error: relationError } = await supabase
    .from('supplier_invoices')
    .select('id, supplier:suppliers(id)')
    .limit(1);

  if (relationError) {
    console.error('❌ Error with Foreign Key relationship:', relationError.message);
    if (relationError.message.includes('Could not find a relationship')) {
      console.error('   -> CAUSE: The foreign key between supplier_invoices and suppliers is missing in the database schema.');
    }
  } else {
    console.log('✅ Foreign Key relationship appears to be working.');
  }

  // 4. Check columns in supplier_invoices
  console.log('\nChecking columns in "supplier_invoices"...');
  // We try to select specific new columns to see if they exist
  const { error: columnsError } = await supabase
    .from('supplier_invoices')
    .select('created_by, metadata')
    .limit(1);

  if (columnsError) {
    console.error('❌ Error accessing new columns (created_by, metadata):', columnsError.message);
  } else {
    console.log('✅ Columns "created_by" and "metadata" seem to exist.');
  }

}

diagnose().catch(err => console.error('Unexpected error:', err));
