import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import {
  applyManualCostXmlImport,
  buildManualCostXmlPreview,
  parseManualCostXmlFile,
  revertManualCostXmlImport,
} from '@/services/manualCostXmlImport';
import type { Cost } from '@/types/costs';
import type { Supplier } from '@/types/suppliers';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const createBaseCost = (overrides: Partial<Cost> = {}): Cost =>
  ({
    id: 'cost-1',
    amount: 100000,
    category_id: 'cat-1',
    cost_center_id: null,
    crane_id: null,
    created_at: '2026-01-15T10:00:00Z',
    created_by: 'user-1',
    date: '2026-01-15',
    description: 'Costo operativo sin factura',
    document_number: null,
    document_type: null,
    immediate_consumption: false,
    inventory_movement_id: null,
    location_text: null,
    maintenance_id: null,
    notes: 'Nota inicial',
    operator_id: null,
    other_reason: null,
    payment_batch_id: null,
    payment_date: null,
    purchase_quantity: null,
    purchase_unit_cost: null,
    receipt_photo_paths: null,
    service_folio: null,
    service_id: null,
    subcategory: null,
    supplier_id: 'supplier-1',
    supplier_invoice_id: null,
    supplier_payment_id: null,
    updated_at: '2026-01-15T10:00:00Z',
    cost_categories: { id: 'cat-1', name: 'Mantenimiento' } as any,
    cost_centers: null,
    cranes: null,
    operators: null,
    services: null,
    crane_parts: null,
    crane_maintenance: null,
    creator: null,
    ...overrides,
  }) as Cost;

const createSupplier = (): Supplier =>
  ({
    id: 'supplier-1',
    name: 'Proveedor Demo',
    rut: '76.123.456-7',
    email: 'proveedor@example.com',
    phone: null,
    address: null,
    contact_person: null,
    contact_name: null,
    category: 'mantenimiento',
    subcategory: null,
    notes: null,
    payment_terms: null,
    default_payment_term_id: null,
    credit_date: null,
    delivery_time_days: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: 'user-1',
    updated_by: null,
  }) as Supplier;

const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<DTE>
  <Documento>
    <Encabezado>
      <IdDoc>
        <TipoDTE>33</TipoDTE>
        <Folio>12345</Folio>
        <FchEmis>2026-01-16</FchEmis>
        <FchVenc>2026-02-15</FchVenc>
      </IdDoc>
      <Emisor>
        <RUTEmisor>761234567</RUTEmisor>
        <RznSoc>Proveedor Demo</RznSoc>
        <GiroEmis>Mantenimiento</GiroEmis>
      </Emisor>
      <Totales>
        <MntNeto>100000</MntNeto>
        <IVA>19000</IVA>
        <MntTotal>119000</MntTotal>
      </Totales>
    </Encabezado>
    <Detalle>
      <NmbItem>Filtro hidráulico</NmbItem>
      <QtyItem>2</QtyItem>
      <MontoItem>50000</MontoItem>
    </Detalle>
  </Documento>
</DTE>`;

describe('manualCostXmlImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parsea y mapea un XML DTE compatible con el importador existente', async () => {
    const file = new File([xmlContent], 'factura.xml', { type: 'text/xml' });

    const result = await parseManualCostXmlFile(file);

    expect(result.document.folio).toBe('12345');
    expect(result.document.issue_date).toBe('2026-01-16');
    expect(result.document.total_amount).toBe(119000);
    expect(result.document.items?.[0]?.description).toBe('Filtro hidráulico');
    expect(result.supplier?.name).toBe('Proveedor Demo');
  });

  it('genera vista previa con conflictos y cambios para sobrescritura', () => {
    const cost = createBaseCost({
      amount: 100000,
      document_number: 'ANT-001',
      service_folio: 'SRV-10',
    });
    const supplier = createSupplier();

    const preview = buildManualCostXmlPreview({
      cost,
      document: {
        folio: '12345',
        document_type: 'Factura Electrónica',
        issue_date: '2026-01-16',
        due_date: '2026-02-15',
        net_amount: 100000,
        vat_amount: 19000,
        total_amount: 119000,
        currency: 'CLP',
        description: 'Proveedor Demo Filtro hidráulico',
        supplier_rut: supplier.rut || '',
        items: [
          {
            description: 'Filtro hidráulico',
            quantity: 2,
            unit_price: 50000,
            total: 119000,
          },
        ],
      },
      supplier: {
        name: supplier.name,
        rut: supplier.rut || '',
        email: supplier.email || '',
        phone: '',
        address: '',
        contact_name: '',
        category: 'mantenimiento',
        is_active: true,
      },
      supplierMatch: supplier,
      mode: 'overwrite',
      fileName: 'factura.xml',
    });

    expect(preview.fieldChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'amount', action: 'overwrite', incomingValue: 119000 }),
        expect.objectContaining({ field: 'document_number', action: 'overwrite', incomingValue: '12345' }),
      ])
    );
    expect(preview.conflicts.map((item) => item.code)).toEqual(
      expect.arrayContaining(['amount_mismatch', 'cost_has_different_invoice', 'service_folio_conflict'])
    );
  });

  it('aplica la importación manual, actualiza costo y registra auditoría', async () => {
    const currentCost = createBaseCost();
    const updatedCost = createBaseCost({
      amount: 119000,
      description: 'Filtro Hidráulico',
      document_number: '12345',
      document_type: 'Factura Electrónica',
      service_folio: '12345',
      supplier_invoice_id: 'inv-1',
      notes: expect.any(String) as any,
    });
    const supplier = createSupplier();

    const profilesSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null });
    const costsSingle = vi.fn().mockResolvedValue({ data: currentCost, error: null });
    const supplierInvoicesMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const supplierInvoicesInsertSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'inv-1',
        supplier_id: supplier.id,
        invoice_number: '12345',
        issue_date: '2026-01-16',
        due_date: '2026-02-15',
        amount: 119000,
        net_amount: 100000,
        tax_amount: 19000,
        description: 'Filtro Hidráulico',
        product_service_description: '1. Filtro hidráulico',
        currency: 'CLP',
        status: 'pending',
        xml_file_name: 'factura.xml',
        source_module: 'manual_cost_xml',
      },
      error: null,
    });
    const paymentsMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const rpcMock = vi.fn().mockImplementation((fnName: string, args?: Record<string, unknown>) => {
      if (fnName === 'log_cost_snapshot_entry') {
        expect(args).toEqual(
          expect.objectContaining({
            p_cost_id: 'cost-1',
            p_field_name: expect.stringContaining('manual_xml_import_snapshot:'),
          })
        );
        return Promise.resolve({ error: null });
      }

      if (fnName === 'log_audit_entry') {
        expect(args).toEqual(
          expect.objectContaining({
            p_operation: 'MANUAL_XML_IMPORT',
            p_table_name: 'costs',
          })
        );
        return Promise.resolve({ error: null });
      }

      return Promise.resolve({ error: null });
    });

    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'user-1' } } });
    (supabase.rpc as any).mockImplementation(rpcMock);
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: profilesSingle }),
          }),
        };
      }

      if (table === 'costs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: costsSingle }),
          }),
          update: vi.fn().mockImplementation((payload) => ({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockImplementation(async () => {
                  expect(payload).toEqual(
                    expect.objectContaining({
                      amount: 119000,
                      document_number: '12345',
                      supplier_invoice_id: 'inv-1',
                    })
                  );
                  return { data: updatedCost, error: null };
                }),
              }),
            }),
          })),
        };
      }

      if (table === 'supplier_invoices') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle: supplierInvoicesMaybeSingle }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: supplierInvoicesInsertSingle }),
          }),
        };
      }

      if (table === 'supplier_payments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({ maybeSingle: paymentsMaybeSingle }),
              }),
            }),
          }),
        };
      }

      if (table === 'supplier_invoice_items') {
        return {
          delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === 'inventory_items') {
        return {
          select: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await applyManualCostXmlImport({
      costId: currentCost.id,
      fileName: 'factura.xml',
      mode: 'overwrite',
      document: {
        folio: '12345',
        document_type: 'Factura Electrónica',
        issue_date: '2026-01-16',
        due_date: '2026-02-15',
        net_amount: 100000,
        vat_amount: 19000,
        total_amount: 119000,
        currency: 'CLP',
        description: 'Proveedor Demo Filtro hidráulico',
        supplier_rut: supplier.rut || '',
        items: [
          {
            description: 'Filtro hidráulico',
            quantity: 2,
            unit_price: 50000,
            total: 119000,
          },
        ],
      },
      supplier: {
        name: supplier.name,
        rut: supplier.rut || '',
        email: supplier.email || '',
        phone: '',
        address: '',
        contact_name: '',
        category: 'mantenimiento',
        is_active: true,
      },
      suppliers: [supplier],
      confirmedConflictCodes: ['amount_mismatch'],
    });

    expect(result.updatedCost.supplier_invoice_id).toBe('inv-1');
    expect(rpcMock).toHaveBeenCalledWith(
      'log_cost_snapshot_entry',
      expect.objectContaining({
        p_cost_id: 'cost-1',
        p_field_name: expect.stringContaining('manual_xml_import_snapshot:'),
      })
    );
    expect(rpcMock).toHaveBeenCalledWith(
      'log_audit_entry',
      expect.objectContaining({
        p_operation: 'MANUAL_XML_IMPORT',
        p_table_name: 'costs',
      })
    );
  });

  it('revierte una importación manual y restaura el snapshot original', async () => {
    const currentCost = createBaseCost({
      amount: 119000,
      document_number: '12345',
      supplier_invoice_id: 'inv-1',
    });
    const restoredCost = createBaseCost();
    const supplierInvoiceDeleteEq = vi.fn().mockResolvedValue({ error: null });
    const rpcMock = vi.fn().mockImplementation((fnName: string, args?: Record<string, unknown>) => {
      if (fnName === 'log_cost_snapshot_entry') {
        expect(args).toEqual(
          expect.objectContaining({
            p_cost_id: 'cost-1',
            p_field_name: expect.stringContaining('manual_xml_import_revert:'),
          })
        );
        return Promise.resolve({ error: null });
      }

      if (fnName === 'log_audit_entry') {
        expect(args).toEqual(
          expect.objectContaining({
            p_operation: 'MANUAL_XML_IMPORT_REVERT',
            p_table_name: 'costs',
          })
        );
        return Promise.resolve({ error: null });
      }

      return Promise.resolve({ error: null });
    });

    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'user-1' } } });
    (supabase.rpc as any).mockImplementation(rpcMock);
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }) }),
          }),
        };
      }

      if (table === 'cost_change_history') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'hist-1',
                    cost_id: 'cost-1',
                    field_name: 'manual_xml_import_snapshot:snap-1',
                    old_value: JSON.stringify(createBaseCost()),
                    new_value: JSON.stringify(currentCost),
                    change_summary: 'Importación manual XML de factura 12345',
                    change_context: JSON.stringify({
                      source: 'manual_cost_xml_import',
                      snapshotId: 'snap-1',
                      fileName: 'factura.xml',
                      importMode: 'overwrite',
                      document: { folio: '12345' },
                      supplier: null,
                      invoiceBefore: null,
                      invoiceAfter: { id: 'inv-1' },
                      paymentBefore: null,
                      paymentAfter: null,
                      previousSupplierInvoiceId: null,
                      createdSupplierId: null,
                    }),
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'costs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: currentCost, error: null }) }),
          }),
          update: vi.fn().mockImplementation((payload) => ({
            eq: vi.fn().mockImplementation(() => {
              if ('supplier_invoice_id' in payload && Object.keys(payload).length === 1) {
                return { error: null };
              }

              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: restoredCost, error: null }),
                }),
              };
            }),
          })),
        };
      }

      if (table === 'supplier_invoices') {
        return {
          delete: vi.fn().mockReturnValue({ eq: supplierInvoiceDeleteEq }),
        };
      }

      if (table === 'supplier_payments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      }

      return {};
    });

    const result = await revertManualCostXmlImport({
      costId: 'cost-1',
      historyId: 'hist-1',
    });

    expect(result.amount).toBe(100000);
    expect(supplierInvoiceDeleteEq).toHaveBeenCalledWith('id', 'inv-1');
    expect(rpcMock).toHaveBeenCalledWith(
      'log_cost_snapshot_entry',
      expect.objectContaining({
        p_field_name: expect.stringContaining('manual_xml_import_revert:'),
      })
    );
    expect(rpcMock).toHaveBeenCalledWith(
      'log_audit_entry',
      expect.objectContaining({
        p_operation: 'MANUAL_XML_IMPORT_REVERT',
      })
    );
  });
});
