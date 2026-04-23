export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          id: number
          new_data: Json | null
          old_data: Json | null
          operation: string
          table_name: string
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          table_name: string
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          table_name?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_logs: {
        Row: {
          backup_type: string
          created_at: string | null
          created_by: string | null
          error_message: string | null
          file_size_bytes: number | null
          id: string
          metadata: Json | null
          status: string
        }
        Insert: {
          backup_type: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          status: string
        }
        Update: {
          backup_type?: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          client_id: string | null
          crane_id: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          end_time: string
          id: string
          operator_id: string | null
          service_id: string | null
          start_time: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          crane_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          end_time: string
          id?: string
          operator_id?: string | null
          service_id?: string | null
          start_time: string
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          crane_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          end_time?: string
          id?: string
          operator_id?: string | null
          service_id?: string | null
          start_time?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_crane_id_fkey"
            columns: ["crane_id"]
            isOneToOne: false
            referencedRelation: "cranes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["related_service_id_actual"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          billing_type: string
          contact_name: string | null
          created_at: string | null
          created_by: string | null
          default_payment_term_id: string | null
          department: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          rut: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          billing_type?: string
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          default_payment_term_id?: string | null
          department: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          rut: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          billing_type?: string
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          default_payment_term_id?: string | null
          department?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          rut?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_default_payment_term_id_fkey"
            columns: ["default_payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      closure_services: {
        Row: {
          closure_id: string
          id: string
          service_id: string
        }
        Insert: {
          closure_id: string
          id?: string
          service_id: string
        }
        Update: {
          closure_id?: string
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "closure_services_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "service_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closure_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closure_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closure_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["related_service_id_actual"]
          },
        ]
      }
      company_data: {
        Row: {
          address: string
          alert_days: number | null
          business_name: string
          created_at: string | null
          daily_report_emails: string | null
          daily_report_enabled: boolean | null
          daily_report_hour: number | null
          email: string
          excess_folio_format: string | null
          folio_format: string | null
          id: string
          invoice_due_days: number | null
          legal_texts: string | null
          logo_url: string | null
          next_excess_folio_number: number | null
          next_invoice_folio_number: number | null
          next_service_folio_number: number
          phone: string
          report_timezone: string
          report_use_system_timezone: boolean
          rut: string
          updated_at: string | null
          vat_percentage: number | null
          website: string | null
        }
        Insert: {
          address: string
          alert_days?: number | null
          business_name: string
          created_at?: string | null
          daily_report_emails?: string | null
          daily_report_enabled?: boolean | null
          daily_report_hour?: number | null
          email: string
          excess_folio_format?: string | null
          folio_format?: string | null
          id?: string
          invoice_due_days?: number | null
          legal_texts?: string | null
          logo_url?: string | null
          next_excess_folio_number?: number | null
          next_invoice_folio_number?: number | null
          next_service_folio_number?: number
          phone: string
          report_timezone?: string
          report_use_system_timezone?: boolean
          rut: string
          updated_at?: string | null
          vat_percentage?: number | null
          website?: string | null
        }
        Update: {
          address?: string
          alert_days?: number | null
          business_name?: string
          created_at?: string | null
          daily_report_emails?: string | null
          daily_report_enabled?: boolean | null
          daily_report_hour?: number | null
          email?: string
          excess_folio_format?: string | null
          folio_format?: string | null
          id?: string
          invoice_due_days?: number | null
          legal_texts?: string | null
          logo_url?: string | null
          next_excess_folio_number?: number | null
          next_invoice_folio_number?: number | null
          next_service_folio_number?: number
          phone?: string
          report_timezone?: string
          report_use_system_timezone?: boolean
          rut?: string
          updated_at?: string | null
          vat_percentage?: number | null
          website?: string | null
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          logo_url: string | null
          name: string
          phone: string | null
          rut: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          rut: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          rut?: string
          updated_at?: string
        }
        Relationships: []
      }
      cost_bulk_payment_operations: {
        Row: {
          already_paid_cost_ids: string[]
          error_message: string | null
          executed_at: string
          executed_by: string
          id: string
          missing_cost_ids: string[]
          payment_date: string | null
          processed_cost_ids: string[]
          requested_cost_ids: string[]
          status: string
          use_cost_date: boolean
        }
        Insert: {
          already_paid_cost_ids?: string[]
          error_message?: string | null
          executed_at?: string
          executed_by: string
          id?: string
          missing_cost_ids?: string[]
          payment_date?: string | null
          processed_cost_ids?: string[]
          requested_cost_ids: string[]
          status?: string
          use_cost_date?: boolean
        }
        Update: {
          already_paid_cost_ids?: string[]
          error_message?: string | null
          executed_at?: string
          executed_by?: string
          id?: string
          missing_cost_ids?: string[]
          payment_date?: string | null
          processed_cost_ids?: string[]
          requested_cost_ids?: string[]
          status?: string
          use_cost_date?: boolean
        }
        Relationships: []
      }
      cost_categories: {
        Row: {
          created_at: string
          default_cost_center_id: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          default_cost_center_id?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          default_cost_center_id?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_categories_default_cost_center_id_fkey"
            columns: ["default_cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          budget_amount: number | null
          budget_period: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          budget_amount?: number | null
          budget_period?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          budget_amount?: number | null
          budget_period?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_inventory_items: {
        Row: {
          cost_id: string
          created_at: string
          created_by: string | null
          id: string
          inventory_item_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          cost_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id: string
          quantity?: number
          unit_cost?: number
        }
        Update: {
          cost_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_inventory_items_cost_id_fkey"
            columns: ["cost_id"]
            isOneToOne: false
            referencedRelation: "costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_inventory_items_cost_id_fkey"
            columns: ["cost_id"]
            isOneToOne: false
            referencedRelation: "orphan_crane_parts_candidates"
            referencedColumns: ["candidate_cost_id"]
          },
          {
            foreignKeyName: "cost_inventory_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_subcategories: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          other_reasons: Json | null
          requires_crane: boolean
          requires_document: boolean
          requires_location: boolean
          requires_operator: boolean
          requires_other_reason: boolean
          requires_supplier: boolean
          routes_to_inventory: boolean
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          other_reasons?: Json | null
          requires_crane?: boolean
          requires_document?: boolean
          requires_location?: boolean
          requires_operator?: boolean
          requires_other_reason?: boolean
          requires_supplier?: boolean
          routes_to_inventory?: boolean
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          other_reasons?: Json | null
          requires_crane?: boolean
          requires_document?: boolean
          requires_location?: boolean
          requires_operator?: boolean
          requires_other_reason?: boolean
          requires_supplier?: boolean
          routes_to_inventory?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cost_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      costs: {
        Row: {
          amount: number
          category_id: string
          cost_center_id: string | null
          crane_id: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string
          document_number: string | null
          document_type: string | null
          id: string
          immediate_consumption: boolean | null
          inventory_movement_id: string | null
          location_text: string | null
          maintenance_id: string | null
          notes: string | null
          operator_id: string | null
          other_reason: string | null
          payment_batch_id: string | null
          payment_date: string | null
          purchase_quantity: number | null
          purchase_unit_cost: number | null
          receipt_photo_paths: string[] | null
          service_folio: string | null
          service_id: string | null
          subcategory: string | null
          supplier_id: string | null
          supplier_invoice_id: string | null
          supplier_payment_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category_id: string
          cost_center_id?: string | null
          crane_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description: string
          document_number?: string | null
          document_type?: string | null
          id?: string
          immediate_consumption?: boolean | null
          inventory_movement_id?: string | null
          location_text?: string | null
          maintenance_id?: string | null
          notes?: string | null
          operator_id?: string | null
          other_reason?: string | null
          payment_batch_id?: string | null
          payment_date?: string | null
          purchase_quantity?: number | null
          purchase_unit_cost?: number | null
          receipt_photo_paths?: string[] | null
          service_folio?: string | null
          service_id?: string | null
          subcategory?: string | null
          supplier_id?: string | null
          supplier_invoice_id?: string | null
          supplier_payment_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string
          cost_center_id?: string | null
          crane_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          document_number?: string | null
          document_type?: string | null
          id?: string
          immediate_consumption?: boolean | null
          inventory_movement_id?: string | null
          location_text?: string | null
          maintenance_id?: string | null
          notes?: string | null
          operator_id?: string | null
          other_reason?: string | null
          payment_batch_id?: string | null
          payment_date?: string | null
          purchase_quantity?: number | null
          purchase_unit_cost?: number | null
          receipt_photo_paths?: string[] | null
          service_folio?: string | null
          service_id?: string | null
          subcategory?: string | null
          supplier_id?: string | null
          supplier_invoice_id?: string | null
          supplier_payment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "costs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cost_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_crane_id_fkey"
            columns: ["crane_id"]
            isOneToOne: false
            referencedRelation: "cranes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_inventory_movement_id_fkey"
            columns: ["inventory_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_maintenance_id_fkey"
            columns: ["maintenance_id"]
            isOneToOne: false
            referencedRelation: "crane_maintenance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["related_service_id_actual"]
          },
          {
            foreignKeyName: "costs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      crane_consumption_rates: {
        Row: {
          base_consumption_per_km: number
          crane_type: string
          created_at: string
          fuel_type: string
          id: string
          is_active: boolean
          loaded_consumption_factor: number
          toll_vehicle_category: string
          towing_consumption_factor: number
          updated_at: string
        }
        Insert: {
          base_consumption_per_km: number
          crane_type: string
          created_at?: string
          fuel_type?: string
          id?: string
          is_active?: boolean
          loaded_consumption_factor?: number
          toll_vehicle_category?: string
          towing_consumption_factor?: number
          updated_at?: string
        }
        Update: {
          base_consumption_per_km?: number
          crane_type?: string
          created_at?: string
          fuel_type?: string
          id?: string
          is_active?: boolean
          loaded_consumption_factor?: number
          toll_vehicle_category?: string
          towing_consumption_factor?: number
          updated_at?: string
        }
        Relationships: []
      }
      crane_documents: {
        Row: {
          content_type: string | null
          crane_id: string
          created_at: string
          document_type: string
          expiry_date: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          crane_id: string
          created_at?: string
          document_type: string
          expiry_date?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          crane_id?: string
          created_at?: string
          document_type?: string
          expiry_date?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crane_documents_crane_id_fkey"
            columns: ["crane_id"]
            isOneToOne: false
            referencedRelation: "cranes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crane_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crane_maintenance: {
        Row: {
          completed_date: string | null
          cost: number
          crane_id: string
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          kilometraje: number | null
          maintenance_type: string
          next_maintenance_date: string | null
          notes: string | null
          performed_by: string | null
          provider: string | null
          receipt_photo_paths: string[] | null
          scheduled_date: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_date?: string | null
          cost?: number
          crane_id: string
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          kilometraje?: number | null
          maintenance_type: string
          next_maintenance_date?: string | null
          notes?: string | null
          performed_by?: string | null
          provider?: string | null
          receipt_photo_paths?: string[] | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          completed_date?: string | null
          cost?: number
          crane_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          kilometraje?: number | null
          maintenance_type?: string
          next_maintenance_date?: string | null
          notes?: string | null
          performed_by?: string | null
          provider?: string | null
          receipt_photo_paths?: string[] | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crane_maintenance_crane_id_fkey"
            columns: ["crane_id"]
            isOneToOne: false
            referencedRelation: "cranes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crane_maintenance_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crane_parts: {
        Row: {
          cost_id: string | null
          crane_id: string
          created_at: string
          created_by: string | null
          date: string
          id: string
          inventory_movement_id: string | null
          kilometraje: number | null
          notes: string | null
          part_name: string
          phone: string | null
          quantity: number
          supplier: string
          supplier_id: string | null
          total_value: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          cost_id?: string | null
          crane_id: string
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          inventory_movement_id?: string | null
          kilometraje?: number | null
          notes?: string | null
          part_name: string
          phone?: string | null
          quantity: number
          supplier: string
          supplier_id?: string | null
          total_value?: number | null
          unit_price: number
          updated_at?: string
        }
        Update: {
          cost_id?: string | null
          crane_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          inventory_movement_id?: string | null
          kilometraje?: number | null
          notes?: string | null
          part_name?: string
          phone?: string | null
          quantity?: number
          supplier?: string
          supplier_id?: string | null
          total_value?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crane_parts_crane_id_fkey"
            columns: ["crane_id"]
            isOneToOne: false
            referencedRelation: "cranes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crane_parts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crane_parts_inventory_movement_id_fkey"
            columns: ["inventory_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crane_parts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_crane_parts_cost_id"
            columns: ["cost_id"]
            isOneToOne: false
            referencedRelation: "costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_crane_parts_cost_id"
            columns: ["cost_id"]
            isOneToOne: false
            referencedRelation: "orphan_crane_parts_candidates"
            referencedColumns: ["candidate_cost_id"]
          },
        ]
      }
      cranes: {
        Row: {
          brand: string
          circulation_permit_expiry: string
          created_at: string | null
          created_by: string | null
          id: string
          insurance_expiry: string
          is_active: boolean | null
          license_plate: string
          model: string
          owner_company_name: string | null
          owner_company_rut: string | null
          technical_review_expiry: string
          toll_vehicle_category: string
          type: Database["public"]["Enums"]["crane_type"]
          updated_at: string | null
        }
        Insert: {
          brand: string
          circulation_permit_expiry: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          insurance_expiry: string
          is_active?: boolean | null
          license_plate: string
          model: string
          owner_company_name?: string | null
          owner_company_rut?: string | null
          technical_review_expiry: string
          toll_vehicle_category?: string
          type: Database["public"]["Enums"]["crane_type"]
          updated_at?: string | null
        }
        Update: {
          brand?: string
          circulation_permit_expiry?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          insurance_expiry?: string
          is_active?: boolean | null
          license_plate?: string
          model?: string
          owner_company_name?: string | null
          owner_company_rut?: string | null
          technical_review_expiry?: string
          toll_vehicle_category?: string
          type?: Database["public"]["Enums"]["crane_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cranes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creditors: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          notes: string | null
          supplier_id: string | null
          type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          notes?: string | null
          supplier_id?: string | null
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          notes?: string | null
          supplier_id?: string | null
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creditors_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_installments: {
        Row: {
          adjustment_amount: number
          created_at: string | null
          created_by: string | null
          debt_id: string
          due_date: string
          id: string
          installment_number: number
          interest_amount: number
          paid_amount: number
          paid_date: string | null
          principal_amount: number
          status: string
          total_amount: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          adjustment_amount?: number
          created_at?: string | null
          created_by?: string | null
          debt_id: string
          due_date: string
          id?: string
          installment_number: number
          interest_amount?: number
          paid_amount?: number
          paid_date?: string | null
          principal_amount: number
          status?: string
          total_amount: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          adjustment_amount?: number
          created_at?: string | null
          created_by?: string | null
          debt_id?: string
          due_date?: string
          id?: string
          installment_number?: number
          interest_amount?: number
          paid_amount?: number
          paid_date?: string | null
          principal_amount?: number
          status?: string
          total_amount?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_installments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          debt_installment_id: string
          id: string
          method: string | null
          notes: string | null
          payment_date: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          debt_installment_id: string
          id?: string
          method?: string | null
          notes?: string | null
          payment_date: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          debt_installment_id?: string
          id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_installment_id_fkey"
            columns: ["debt_installment_id"]
            isOneToOne: false
            referencedRelation: "debt_installments"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          adjustment_enabled: boolean
          adjustment_rate: number | null
          created_at: string | null
          created_by: string | null
          creditor_id: string
          currency: string
          description: string
          first_due_date: string
          frequency: string
          id: string
          installments_count: number
          interest_enabled: boolean
          interest_rate: number | null
          metadata: Json | null
          status: string
          total_amount: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          adjustment_enabled?: boolean
          adjustment_rate?: number | null
          created_at?: string | null
          created_by?: string | null
          creditor_id: string
          currency?: string
          description: string
          first_due_date: string
          frequency?: string
          id?: string
          installments_count: number
          interest_enabled?: boolean
          interest_rate?: number | null
          metadata?: Json | null
          status?: string
          total_amount: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          adjustment_enabled?: boolean
          adjustment_rate?: number | null
          created_at?: string | null
          created_by?: string | null
          creditor_id?: string
          currency?: string
          description?: string
          first_due_date?: string
          frequency?: string
          id?: string
          installments_count?: number
          interest_enabled?: boolean
          interest_rate?: number | null
          metadata?: Json | null
          status?: string
          total_amount?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debts_creditor_id_fkey"
            columns: ["creditor_id"]
            isOneToOne: false
            referencedRelation: "creditors"
            referencedColumns: ["id"]
          },
        ]
      }
      document_alerts: {
        Row: {
          alert_days: number
          crane_id: string
          created_at: string | null
          document_type: string
          email_notifications: boolean | null
          id: string
          is_active: boolean | null
          push_notifications: boolean | null
          updated_at: string | null
        }
        Insert: {
          alert_days?: number
          crane_id: string
          created_at?: string | null
          document_type: string
          email_notifications?: boolean | null
          id?: string
          is_active?: boolean | null
          push_notifications?: boolean | null
          updated_at?: string | null
        }
        Update: {
          alert_days?: number
          crane_id?: string
          created_at?: string | null
          document_type?: string
          email_notifications?: boolean | null
          id?: string
          is_active?: boolean | null
          push_notifications?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_alerts_crane_id_fkey"
            columns: ["crane_id"]
            isOneToOne: false
            referencedRelation: "cranes"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_prices: {
        Row: {
          created_at: string
          currency: string
          fuel_type: string
          id: string
          is_current: boolean
          price_date: string
          price_per_liter: number
          region: string | null
          source: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          fuel_type?: string
          id?: string
          is_current?: boolean
          price_date?: string
          price_per_liter: number
          region?: string | null
          source?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          fuel_type?: string
          id?: string
          is_current?: boolean
          price_date?: string
          price_per_liter?: number
          region?: string | null
          source?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      import_batch_records: {
        Row: {
          batch_id: string
          created_at: string
          id: number
          record_id: string
          table_name: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: number
          record_id: string
          table_name: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: number
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batch_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          error: Json | null
          filename: string | null
          id: string
          payload: Json | null
          rolled_back_at: string | null
          rolled_back_by: string | null
          source_module: string
          status: string
          summary: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: Json | null
          filename?: string | null
          id?: string
          payload?: Json | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          source_module: string
          status?: string
          summary?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: Json | null
          filename?: string | null
          id?: string
          payload?: Json | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          source_module?: string
          status?: string
          summary?: Json | null
        }
        Relationships: []
      }
      income_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      income_subcategories: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "income_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      incomes: {
        Row: {
          amount: number
          bank_reference: string | null
          category_id: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          income_date: string
          invoice_id: string | null
          notes: string | null
          occasional_client_name: string | null
          payment_method: string
          subcategory: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_reference?: string | null
          category_id?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          income_date: string
          invoice_id?: string | null
          notes?: string | null
          occasional_client_name?: string | null
          payment_method: string
          subcategory?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_reference?: string | null
          category_id?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          income_date?: string
          invoice_id?: string | null
          notes?: string | null
          occasional_client_name?: string | null
          payment_method?: string
          subcategory?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incomes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "income_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          client_name: string | null
          client_rut: string | null
          created_at: string
          equipment_checklist: string[]
          id: string
          operator_id: string
          operator_signature: string
          photos_before_service: string[] | null
          photos_client_vehicle: string[] | null
          photos_equipment_used: string[] | null
          service_id: string
          vehicle_observations: string | null
        }
        Insert: {
          client_name?: string | null
          client_rut?: string | null
          created_at?: string
          equipment_checklist: string[]
          id?: string
          operator_id: string
          operator_signature: string
          photos_before_service?: string[] | null
          photos_client_vehicle?: string[] | null
          photos_equipment_used?: string[] | null
          service_id: string
          vehicle_observations?: string | null
        }
        Update: {
          client_name?: string | null
          client_rut?: string | null
          created_at?: string
          equipment_checklist?: string[]
          id?: string
          operator_id?: string
          operator_signature?: string
          photos_before_service?: string[] | null
          photos_client_vehicle?: string[] | null
          photos_equipment_used?: string[] | null
          service_id?: string
          vehicle_observations?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["related_service_id_actual"]
          },
        ]
      }
      inventory_alerts: {
        Row: {
          alert_type: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          item_id: string | null
          last_triggered: string | null
          location_id: string | null
          threshold_value: number | null
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          item_id?: string | null
          last_triggered?: string | null
          location_id?: string | null
          threshold_value?: number | null
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          item_id?: string | null
          last_triggered?: string | null
          location_id?: string | null
          threshold_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_alerts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_alerts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_alerts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_categories: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_consumptions: {
        Row: {
          approved_by: string | null
          consumption_date: string
          cost_center_id: string | null
          crane_id: string
          created_at: string
          created_by: string | null
          id: string
          maintenance_type: string | null
          movement_id: string
          odometer_reading: number | null
          operation_hours: number | null
          operator_id: string | null
          work_order_number: string | null
        }
        Insert: {
          approved_by?: string | null
          consumption_date?: string
          cost_center_id?: string | null
          crane_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          maintenance_type?: string | null
          movement_id: string
          odometer_reading?: number | null
          operation_hours?: number | null
          operator_id?: string | null
          work_order_number?: string | null
        }
        Update: {
          approved_by?: string | null
          consumption_date?: string
          cost_center_id?: string | null
          crane_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          maintenance_type?: string | null
          movement_id?: string
          odometer_reading?: number | null
          operation_hours?: number | null
          operator_id?: string | null
          work_order_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_consumptions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_consumptions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_consumptions_crane_id_fkey"
            columns: ["crane_id"]
            isOneToOne: false
            referencedRelation: "cranes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_consumptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_consumptions_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_consumptions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          barcode: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          has_expiration: boolean | null
          id: string
          is_active: boolean
          is_critical: boolean | null
          maximum_stock: number | null
          minimum_stock: number | null
          name: string
          safety_stock: number | null
          sku: string | null
          unit_cost: number | null
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          has_expiration?: boolean | null
          id?: string
          is_active?: boolean
          is_critical?: boolean | null
          maximum_stock?: number | null
          minimum_stock?: number | null
          name: string
          safety_stock?: number | null
          sku?: string | null
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          has_expiration?: boolean | null
          id?: string
          is_active?: boolean
          is_critical?: boolean | null
          maximum_stock?: number | null
          minimum_stock?: number | null
          name?: string
          safety_stock?: number | null
          sku?: string | null
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          address: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          batch_number: string | null
          cost_id: string | null
          crane_id: string | null
          created_at: string
          created_by: string | null
          expiration_date: string | null
          id: string
          item_id: string
          location_id: string
          maintenance_id: string | null
          movement_date: string
          movement_type: string
          observations: string | null
          operator_id: string | null
          quantity: number
          reason: string | null
          receipt_photo_paths: string[] | null
          reference_document: string | null
          status: string
          supplier_id: string | null
          supplier_invoice_id: string | null
          supplier_invoice_item_id: string | null
          supplier_name: string | null
          total_cost: number | null
          unit_cost: number | null
        }
        Insert: {
          batch_number?: string | null
          cost_id?: string | null
          crane_id?: string | null
          created_at?: string
          created_by?: string | null
          expiration_date?: string | null
          id?: string
          item_id: string
          location_id: string
          maintenance_id?: string | null
          movement_date?: string
          movement_type: string
          observations?: string | null
          operator_id?: string | null
          quantity: number
          reason?: string | null
          receipt_photo_paths?: string[] | null
          reference_document?: string | null
          status?: string
          supplier_id?: string | null
          supplier_invoice_id?: string | null
          supplier_invoice_item_id?: string | null
          supplier_name?: string | null
          total_cost?: number | null
          unit_cost?: number | null
        }
        Update: {
          batch_number?: string | null
          cost_id?: string | null
          crane_id?: string | null
          created_at?: string
          created_by?: string | null
          expiration_date?: string | null
          id?: string
          item_id?: string
          location_id?: string
          maintenance_id?: string | null
          movement_date?: string
          movement_type?: string
          observations?: string | null
          operator_id?: string | null
          quantity?: number
          reason?: string | null
          receipt_photo_paths?: string[] | null
          reference_document?: string | null
          status?: string
          supplier_id?: string | null
          supplier_invoice_id?: string | null
          supplier_invoice_item_id?: string | null
          supplier_name?: string | null
          total_cost?: number | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_cost_id_fkey"
            columns: ["cost_id"]
            isOneToOne: false
            referencedRelation: "costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_cost_id_fkey"
            columns: ["cost_id"]
            isOneToOne: false
            referencedRelation: "orphan_crane_parts_candidates"
            referencedColumns: ["candidate_cost_id"]
          },
          {
            foreignKeyName: "inventory_movements_crane_id_fkey"
            columns: ["crane_id"]
            isOneToOne: false
            referencedRelation: "cranes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_maintenance_id_fkey"
            columns: ["maintenance_id"]
            isOneToOne: false
            referencedRelation: "crane_maintenance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_supplier_invoice_item_id_fkey"
            columns: ["supplier_invoice_item_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoice_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock: {
        Row: {
          available_quantity: number | null
          created_at: string
          current_quantity: number
          id: string
          item_id: string
          last_movement_date: string | null
          location_id: string
          reserved_quantity: number
          updated_at: string
        }
        Insert: {
          available_quantity?: number | null
          created_at?: string
          current_quantity?: number
          id?: string
          item_id: string
          last_movement_date?: string | null
          location_id: string
          reserved_quantity?: number
          updated_at?: string
        }
        Update: {
          available_quantity?: number | null
          created_at?: string
          current_quantity?: number
          id?: string
          item_id?: string
          last_movement_date?: string | null
          location_id?: string
          reserved_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_suppliers: {
        Row: {
          address: string | null
          category: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          credit_date: string | null
          default_payment_term_id: string | null
          delivery_time_days: number | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          rut: string | null
          subcategory: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          category?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_date?: string | null
          default_payment_term_id?: string | null
          delivery_time_days?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          rut?: string | null
          subcategory?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          category?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_date?: string | null
          default_payment_term_id?: string | null
          delivery_time_days?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          rut?: string | null
          subcategory?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_suppliers_default_payment_term_id_fkey"
            columns: ["default_payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_alert_settings: {
        Row: {
          created_at: string | null
          due_soon_alerts_enabled: boolean | null
          due_soon_days: number | null
          email_notifications: boolean | null
          id: string
          overdue_alerts_enabled: boolean | null
          push_notifications: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          due_soon_alerts_enabled?: boolean | null
          due_soon_days?: number | null
          email_notifications?: boolean | null
          id?: string
          overdue_alerts_enabled?: boolean | null
          push_notifications?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          due_soon_alerts_enabled?: boolean | null
          due_soon_days?: number | null
          email_notifications?: boolean | null
          id?: string
          overdue_alerts_enabled?: boolean | null
          push_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invoice_cancellations: {
        Row: {
          cancellation_reason: string
          cancelled_at: string
          cancelled_by: string | null
          created_at: string
          credit_note_number: string
          id: string
          invoice_id: string
          original_client_id: string | null
          original_folio: string
          original_numero_fiscal: string | null
          original_total: number
          reason_details: string | null
        }
        Insert: {
          cancellation_reason: string
          cancelled_at?: string
          cancelled_by?: string | null
          created_at?: string
          credit_note_number: string
          id?: string
          invoice_id: string
          original_client_id?: string | null
          original_folio: string
          original_numero_fiscal?: string | null
          original_total: number
          reason_details?: string | null
        }
        Update: {
          cancellation_reason?: string
          cancelled_at?: string
          cancelled_by?: string | null
          created_at?: string
          credit_note_number?: string
          id?: string
          invoice_id?: string
          original_client_id?: string | null
          original_folio?: string
          original_numero_fiscal?: string | null
          original_total?: number
          reason_details?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_cancellations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_cancellations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_cancellations_original_client_id_fkey"
            columns: ["original_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_closures: {
        Row: {
          closure_id: string
          created_at: string
          id: string
          invoice_id: string
        }
        Insert: {
          closure_id: string
          created_at?: string
          id?: string
          invoice_id: string
        }
        Update: {
          closure_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoice_closures_closure_id"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "service_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_closures_invoice_id"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_closures_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "service_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_closures_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_services: {
        Row: {
          id: string
          invoice_id: string
          service_id: string
        }
        Insert: {
          id?: string
          invoice_id: string
          service_id: string
        }
        Update: {
          id?: string
          invoice_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_services_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["related_service_id_actual"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string | null
          due_date: string
          folio: string
          id: string
          issue_date: string
          notes: string | null
          numero_fiscal: string | null
          paid_amount: number | null
          payment_date: string | null
          payment_term_id: string | null
          product_service_description: string
          remaining_amount: number | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number
          total: number
          updated_at: string | null
          vat: number
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by?: string | null
          due_date: string
          folio: string
          id?: string
          issue_date: string
          notes?: string | null
          numero_fiscal?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_term_id?: string | null
          product_service_description: string
          remaining_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number
          total: number
          updated_at?: string | null
          vat: number
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          due_date?: string
          folio?: string
          id?: string
          issue_date?: string
          notes?: string | null
          numero_fiscal?: string | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_term_id?: string | null
          product_service_description?: string
          remaining_amount?: number | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number
          total?: number
          updated_at?: string | null
          vat?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_term_id_fkey"
            columns: ["payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: string
          sent_at: string | null
          status: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          sent_at?: string | null
          status?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          id?: string
          sent_at?: string | null
          status?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          crane_alerts: boolean | null
          created_at: string | null
          document_expiry_alerts: boolean | null
          email_notifications: boolean | null
          id: string
          maintenance_reminders: boolean | null
          push_notifications: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          crane_alerts?: boolean | null
          created_at?: string | null
          document_expiry_alerts?: boolean | null
          email_notifications?: boolean | null
          id?: string
          maintenance_reminders?: boolean | null
          push_notifications?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          crane_alerts?: boolean | null
          created_at?: string | null
          document_expiry_alerts?: boolean | null
          email_notifications?: boolean | null
          id?: string
          maintenance_reminders?: boolean | null
          push_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_data: Json | null
          action_type: string | null
          action_url: string | null
          category: string
          created_at: string
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          group_count: number | null
          group_key: string | null
          id: string
          message: string
          priority: number
          read_at: string | null
          snoozed_until: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_data?: Json | null
          action_type?: string | null
          action_url?: string | null
          category?: string
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          group_count?: number | null
          group_key?: string | null
          id?: string
          message: string
          priority?: number
          read_at?: string | null
          snoozed_until?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_data?: Json | null
          action_type?: string | null
          action_url?: string | null
          category?: string
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          group_count?: number | null
          group_key?: string | null
          id?: string
          message?: string
          priority?: number
          read_at?: string | null
          snoozed_until?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      operators: {
        Row: {
          commission_exempt: boolean
          created_at: string | null
          created_by: string | null
          department: string | null
          exam_expiry: string | null
          id: string
          is_active: boolean | null
          license_number: string | null
          name: string
          operator_type: string | null
          phone: string | null
          position: string | null
          rut: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          commission_exempt?: boolean
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          exam_expiry?: string | null
          id?: string
          is_active?: boolean | null
          license_number?: string | null
          name: string
          operator_type?: string | null
          phone?: string | null
          position?: string | null
          rut: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          commission_exempt?: boolean
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          exam_expiry?: string | null
          id?: string
          is_active?: boolean | null
          license_number?: string | null
          name?: string
          operator_type?: string | null
          phone?: string | null
          position?: string | null
          rut?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_operators_user_id"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operators_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patent_search_history: {
        Row: {
          año: number | null
          color: string | null
          created_at: string
          id: string
          marca: string
          modelo: string
          patente: string
          user_id: string
        }
        Insert: {
          año?: number | null
          color?: string | null
          created_at?: string
          id?: string
          marca: string
          modelo: string
          patente: string
          user_id: string
        }
        Update: {
          año?: number | null
          color?: string | null
          created_at?: string
          id?: string
          marca?: string
          modelo?: string
          patente?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_applications: {
        Row: {
          application_method:
            | Database["public"]["Enums"]["application_method"]
            | null
          applied_amount: number
          created_at: string | null
          created_by: string | null
          id: string
          invoice_id: string
          notes: string | null
          payment_id: string
        }
        Insert: {
          application_method?:
            | Database["public"]["Enums"]["application_method"]
            | null
          applied_amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_id: string
        }
        Update: {
          application_method?:
            | Database["public"]["Enums"]["application_method"]
            | null
          applied_amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_applications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_applications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_terms: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          days: number | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          days?: number | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          days?: number | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          applied_amount: number | null
          bank_reference: string | null
          client_id: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          remaining_amount: number | null
          status: Database["public"]["Enums"]["payment_status"] | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          applied_amount?: number | null
          bank_reference?: string | null
          client_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date: string
          payment_method?: string | null
          remaining_amount?: number | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          applied_amount?: number | null
          bank_reference?: string | null
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          remaining_amount?: number | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          client_id: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          client_id?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          client_id?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          p256dh_key: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          p256dh_key: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          p256dh_key?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quick_entries: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string | null
          data: Json | null
          date: string
          description: string
          id: string
          location: Json | null
          notes: string | null
          photo_url: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          data?: Json | null
          date?: string
          description: string
          id?: string
          location?: Json | null
          notes?: string | null
          photo_url?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          data?: Json | null
          date?: string
          description?: string
          id?: string
          location?: Json | null
          notes?: string | null
          photo_url?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      route_tolls: {
        Row: {
          created_at: string
          id: string
          is_optional: boolean
          route_id: string
          sequence_order: number
          toll_station_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_optional?: boolean
          route_id: string
          sequence_order?: number
          toll_station_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_optional?: boolean
          route_id?: string
          sequence_order?: number
          toll_station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_tolls_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_tolls_toll_station_id_fkey"
            columns: ["toll_station_id"]
            isOneToOne: false
            referencedRelation: "toll_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          consumption_factor: number
          created_at: string
          created_by: string | null
          destination: string
          difficulty_level: string
          distance_km: number
          estimated_time_hours: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          origin: string
          route_type: string
          updated_at: string
        }
        Insert: {
          consumption_factor?: number
          created_at?: string
          created_by?: string | null
          destination: string
          difficulty_level?: string
          distance_km?: number
          estimated_time_hours?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          origin: string
          route_type?: string
          updated_at?: string
        }
        Update: {
          consumption_factor?: number
          created_at?: string
          created_by?: string | null
          destination?: string
          difficulty_level?: string
          distance_km?: number
          estimated_time_hours?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          origin?: string
          route_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_locations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          latitude: number
          longitude: number
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          latitude: number
          longitude: number
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
        }
        Relationships: []
      }
      scheduled_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          payment_method: string | null
          priority: string | null
          reminder_date: string | null
          reminder_sent: boolean | null
          scheduled_date: string
          status: string | null
          supplier_invoice_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          priority?: string | null
          reminder_date?: string | null
          reminder_sent?: boolean | null
          scheduled_date: string
          status?: string | null
          supplier_invoice_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          priority?: string | null
          reminder_date?: string | null
          reminder_sent?: boolean | null
          scheduled_date?: string
          status?: string | null
          supplier_invoice_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_payments_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      service_cash_receipts: {
        Row: {
          created_at: string
          created_by: string
          folio: string
          id: string
          notes: string | null
          paid_amount: number
          paid_date: string
          payment_method: string
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          folio?: string
          id?: string
          notes?: string | null
          paid_amount: number
          paid_date: string
          payment_method: string
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          folio?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          paid_date?: string
          payment_method?: string
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_cash_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_cash_receipts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_cash_receipts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_cash_receipts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["related_service_id_actual"]
          },
        ]
      }
      service_change_history: {
        Row: {
          change_context: string | null
          change_summary: string | null
          change_type: string
          changed_at: string
          changed_by: string | null
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          service_folio: string
          service_id: string
        }
        Insert: {
          change_context?: string | null
          change_summary?: string | null
          change_type: string
          changed_at?: string
          changed_by?: string | null
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          service_folio: string
          service_id: string
        }
        Update: {
          change_context?: string | null
          change_summary?: string | null
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          service_folio?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_change_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_change_history_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_change_history_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_change_history_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["related_service_id_actual"]
          },
        ]
      }
      service_closures: {
        Row: {
          client_id: string | null
          created_at: string | null
          created_by: string | null
          date_from: string
          date_to: string
          folio: string
          id: string
          purchase_order: string | null
          status: Database["public"]["Enums"]["closure_status"] | null
          total: number
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_from: string
          date_to: string
          folio: string
          id?: string
          purchase_order?: string | null
          status?: Database["public"]["Enums"]["closure_status"] | null
          total: number
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_from?: string
          date_to?: string
          folio?: string
          id?: string
          purchase_order?: string | null
          status?: Database["public"]["Enums"]["closure_status"] | null
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_closures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_closures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_costs: {
        Row: {
          amount: number
          cost_type: string
          crane_id: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string
          id: string
          is_auto_generated: boolean | null
          notes: string | null
          operator_id: string | null
          service_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          cost_type: string
          crane_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description: string
          id?: string
          is_auto_generated?: boolean | null
          notes?: string | null
          operator_id?: string | null
          service_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cost_type?: string
          crane_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          is_auto_generated?: boolean | null
          notes?: string | null
          operator_id?: string | null
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_costs_crane_id_fkey"
            columns: ["crane_id"]
            isOneToOne: false
            referencedRelation: "cranes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_costs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_costs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_costs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_costs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_costs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["related_service_id_actual"]
          },
        ]
      }
      service_rates: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          destination: string | null
          id: string
          is_active: boolean
          notes: string | null
          origin: string | null
          service_type_id: string | null
          updated_at: string
          value: number
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          origin?: string | null
          service_type_id?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          origin?: string | null
          service_type_id?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_rates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_rates_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_resources: {
        Row: {
          commission_amount: number | null
          crane_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean | null
          operator_id: string | null
          resource_type: string
          role: string | null
          service_id: string
          updated_at: string
        }
        Insert: {
          commission_amount?: number | null
          crane_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean | null
          operator_id?: string | null
          resource_type: string
          role?: string | null
          service_id: string
          updated_at?: string
        }
        Update: {
          commission_amount?: number | null
          crane_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean | null
          operator_id?: string | null
          resource_type?: string
          role?: string | null
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_resources_crane_id_fkey"
            columns: ["crane_id"]
            isOneToOne: false
            referencedRelation: "cranes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_resources_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_resources_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_resources_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_resources_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["related_service_id_actual"]
          },
        ]
      }
      service_types: {
        Row: {
          base_price: number | null
          crane_required: boolean
          created_at: string | null
          created_by: string | null
          description: string | null
          destination_required: boolean
          id: string
          is_active: boolean | null
          is_outsourced: boolean
          license_plate_required: boolean
          name: string
          operator_required: boolean
          origin_required: boolean
          purchase_order_required: boolean
          updated_at: string | null
          vehicle_brand_required: boolean
          vehicle_info_optional: boolean
          vehicle_model_required: boolean
        }
        Insert: {
          base_price?: number | null
          crane_required?: boolean
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          destination_required?: boolean
          id?: string
          is_active?: boolean | null
          is_outsourced?: boolean
          license_plate_required?: boolean
          name: string
          operator_required?: boolean
          origin_required?: boolean
          purchase_order_required?: boolean
          updated_at?: string | null
          vehicle_brand_required?: boolean
          vehicle_info_optional?: boolean
          vehicle_model_required?: boolean
        }
        Update: {
          base_price?: number | null
          crane_required?: boolean
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          destination_required?: boolean
          id?: string
          is_active?: boolean | null
          is_outsourced?: boolean
          license_plate_required?: boolean
          name?: string
          operator_required?: boolean
          origin_required?: boolean
          purchase_order_required?: boolean
          updated_at?: string | null
          vehicle_brand_required?: boolean
          vehicle_info_optional?: boolean
          vehicle_model_required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "service_types_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_update_error_logs: {
        Row: {
          attempted_data: Json | null
          created_at: string | null
          error_code: string | null
          error_details: Json | null
          error_message: string | null
          id: string
          service_id: string | null
          user_id: string | null
        }
        Insert: {
          attempted_data?: Json | null
          created_at?: string | null
          error_code?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          service_id?: string | null
          user_id?: string | null
        }
        Update: {
          attempted_data?: Json | null
          created_at?: string | null
          error_code?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          service_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_update_error_logs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_update_error_logs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_update_error_logs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["related_service_id_actual"]
          },
        ]
      }
      services: {
        Row: {
          client_covered_amount: number | null
          client_id: string
          company_name: string | null
          company_rut: string | null
          crane_id: string | null
          crane_mileage: number | null
          created_at: string | null
          created_by: string | null
          custody_daily_rate: number | null
          custody_days: number | null
          custody_discount_percentage: number | null
          custody_end_date: string | null
          custody_mode: string | null
          custody_notes: string | null
          custody_rate_type: string | null
          custody_start_date: string | null
          custody_total_amount: number | null
          custody_vehicle_type: string | null
          destination: string | null
          end_time: string | null
          excess_amount: number | null
          folio: string
          has_excess: boolean
          id: string
          insured_name: string | null
          invoice_folio: string | null
          invoice_numero_fiscal: string | null
          license_plate: string | null
          observations: string | null
          operator_commission: number | null
          operator_id: string | null
          origin: string | null
          outsourced_cost: number | null
          outsourced_notes: string | null
          outsourced_provider_id: string | null
          purchase_order: string | null
          purchase_order_number: string | null
          quote_number: string | null
          related_service_id: string | null
          request_date: string
          service_date: string
          service_relationship_type: string | null
          service_type_id: string
          start_time: string | null
          status: Database["public"]["Enums"]["service_status"] | null
          third_party_client_id: string | null
          updated_at: string | null
          value: number
          vehicle_brand: string | null
          vehicle_model: string | null
        }
        Insert: {
          client_covered_amount?: number | null
          client_id: string
          company_name?: string | null
          company_rut?: string | null
          crane_id?: string | null
          crane_mileage?: number | null
          created_at?: string | null
          created_by?: string | null
          custody_daily_rate?: number | null
          custody_days?: number | null
          custody_discount_percentage?: number | null
          custody_end_date?: string | null
          custody_mode?: string | null
          custody_notes?: string | null
          custody_rate_type?: string | null
          custody_start_date?: string | null
          custody_total_amount?: number | null
          custody_vehicle_type?: string | null
          destination?: string | null
          end_time?: string | null
          excess_amount?: number | null
          folio: string
          has_excess?: boolean
          id?: string
          insured_name?: string | null
          invoice_folio?: string | null
          invoice_numero_fiscal?: string | null
          license_plate?: string | null
          observations?: string | null
          operator_commission?: number | null
          operator_id?: string | null
          origin?: string | null
          outsourced_cost?: number | null
          outsourced_notes?: string | null
          outsourced_provider_id?: string | null
          purchase_order?: string | null
          purchase_order_number?: string | null
          quote_number?: string | null
          related_service_id?: string | null
          request_date: string
          service_date: string
          service_relationship_type?: string | null
          service_type_id: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["service_status"] | null
          third_party_client_id?: string | null
          updated_at?: string | null
          value: number
          vehicle_brand?: string | null
          vehicle_model?: string | null
        }
        Update: {
          client_covered_amount?: number | null
          client_id?: string
          company_name?: string | null
          company_rut?: string | null
          crane_id?: string | null
          crane_mileage?: number | null
          created_at?: string | null
          created_by?: string | null
          custody_daily_rate?: number | null
          custody_days?: number | null
          custody_discount_percentage?: number | null
          custody_end_date?: string | null
          custody_mode?: string | null
          custody_notes?: string | null
          custody_rate_type?: string | null
          custody_start_date?: string | null
          custody_total_amount?: number | null
          custody_vehicle_type?: string | null
          destination?: string | null
          end_time?: string | null
          excess_amount?: number | null
          folio?: string
          has_excess?: boolean
          id?: string
          insured_name?: string | null
          invoice_folio?: string | null
          invoice_numero_fiscal?: string | null
          license_plate?: string | null
          observations?: string | null
          operator_commission?: number | null
          operator_id?: string | null
          origin?: string | null
          outsourced_cost?: number | null
          outsourced_notes?: string | null
          outsourced_provider_id?: string | null
          purchase_order?: string | null
          purchase_order_number?: string | null
          quote_number?: string | null
          related_service_id?: string | null
          request_date?: string
          service_date?: string
          service_relationship_type?: string | null
          service_type_id?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["service_status"] | null
          third_party_client_id?: string | null
          updated_at?: string | null
          value?: number
          vehicle_brand?: string | null
          vehicle_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_crane_id_fkey"
            columns: ["crane_id"]
            isOneToOne: false
            referencedRelation: "cranes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_outsourced_provider_id_fkey"
            columns: ["outsourced_provider_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_related_service_id_fkey"
            columns: ["related_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_related_service_id_fkey"
            columns: ["related_service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_related_service_id_fkey"
            columns: ["related_service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["related_service_id_actual"]
          },
          {
            foreignKeyName: "services_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_third_party_client_id_fkey"
            columns: ["third_party_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_categories: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          label: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_invoice_items: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          inventory_item_id: string
          line_number: number
          movement_id: string | null
          product_code: string | null
          product_name: string | null
          quantity: number
          subtotal: number
          supplier_invoice_id: string
          tax_amount: number
          tax_rate: number | null
          total_amount: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          inventory_item_id: string
          line_number: number
          movement_id?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity: number
          subtotal?: number
          supplier_invoice_id: string
          tax_amount?: number
          tax_rate?: number | null
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          inventory_item_id?: string
          line_number?: number
          movement_id?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number
          subtotal?: number
          supplier_invoice_id?: string
          tax_amount?: number
          tax_rate?: number | null
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoice_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_items_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_items_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          amount: number
          balance: number | null
          created_at: string | null
          currency: string | null
          description: string | null
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          net_amount: number
          paid_amount: number | null
          payment_terms: number | null
          product_service_description: string
          source_module: string
          status: string | null
          supplier_id: string | null
          tax_amount: number | null
          updated_at: string | null
          xml_file_name: string | null
        }
        Insert: {
          amount: number
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          due_date: string
          id?: string
          invoice_number: string
          issue_date: string
          net_amount: number
          paid_amount?: number | null
          payment_terms?: number | null
          product_service_description: string
          source_module?: string
          status?: string | null
          supplier_id?: string | null
          tax_amount?: number | null
          updated_at?: string | null
          xml_file_name?: string | null
        }
        Update: {
          amount?: number
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          net_amount?: number
          paid_amount?: number | null
          payment_terms?: number | null
          product_service_description?: string
          source_module?: string
          status?: string | null
          supplier_id?: string | null
          tax_amount?: number | null
          updated_at?: string | null
          xml_file_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          add_to_inventory: boolean | null
          amount: number
          category: string
          cost_id: string | null
          crane_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_amount: number | null
          paid_date: string | null
          part_name: string | null
          part_quantity: number | null
          part_unit_price: number | null
          reference_number: string | null
          status: string
          subcategory: string | null
          supplier_id: string | null
          supplier_invoice_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          add_to_inventory?: boolean | null
          amount: number
          category: string
          cost_id?: string | null
          crane_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          part_name?: string | null
          part_quantity?: number | null
          part_unit_price?: number | null
          reference_number?: string | null
          status?: string
          subcategory?: string | null
          supplier_id?: string | null
          supplier_invoice_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          add_to_inventory?: boolean | null
          amount?: number
          category?: string
          cost_id?: string | null
          crane_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          part_name?: string | null
          part_quantity?: number | null
          part_unit_price?: number | null
          reference_number?: string | null
          status?: string
          subcategory?: string | null
          supplier_id?: string | null
          supplier_invoice_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_cost_id_fkey"
            columns: ["cost_id"]
            isOneToOne: false
            referencedRelation: "costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_cost_id_fkey"
            columns: ["cost_id"]
            isOneToOne: false
            referencedRelation: "orphan_crane_parts_candidates"
            referencedColumns: ["candidate_cost_id"]
          },
          {
            foreignKeyName: "supplier_payments_crane_id_fkey"
            columns: ["crane_id"]
            isOneToOne: false
            referencedRelation: "cranes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          category: string
          contact_name: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          rut: string
          subcategory: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          category?: string
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          rut: string
          subcategory?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          category?: string
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          rut?: string
          subcategory?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          ai_chat_enabled: boolean
          auto_backup: boolean
          backup_frequency: string
          created_at: string
          data_retention: number
          email_notifications: boolean
          id: string
          invoice_alerts: boolean
          maintenance_mode: boolean
          overdue_notifications: boolean
          report_column_config: Json | null
          service_reminders: boolean
          session_timeout_enabled: boolean | null
          session_timeout_minutes: number | null
          session_warning_minutes: number | null
          system_updates: boolean
          updated_at: string
        }
        Insert: {
          ai_chat_enabled?: boolean
          auto_backup?: boolean
          backup_frequency?: string
          created_at?: string
          data_retention?: number
          email_notifications?: boolean
          id?: string
          invoice_alerts?: boolean
          maintenance_mode?: boolean
          overdue_notifications?: boolean
          report_column_config?: Json | null
          service_reminders?: boolean
          session_timeout_enabled?: boolean | null
          session_timeout_minutes?: number | null
          session_warning_minutes?: number | null
          system_updates?: boolean
          updated_at?: string
        }
        Update: {
          ai_chat_enabled?: boolean
          auto_backup?: boolean
          backup_frequency?: string
          created_at?: string
          data_retention?: number
          email_notifications?: boolean
          id?: string
          invoice_alerts?: boolean
          maintenance_mode?: boolean
          overdue_notifications?: boolean
          report_column_config?: Json | null
          service_reminders?: boolean
          session_timeout_enabled?: boolean | null
          session_timeout_minutes?: number | null
          session_warning_minutes?: number | null
          system_updates?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      toll_rates: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_active: boolean
          rate_amount: number
          toll_station_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
          vehicle_category: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          rate_amount?: number
          toll_station_id: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          vehicle_category: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          rate_amount?: number
          toll_station_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          vehicle_category?: string
        }
        Relationships: [
          {
            foreignKeyName: "toll_rates_toll_station_id_fkey"
            columns: ["toll_station_id"]
            isOneToOne: false
            referencedRelation: "toll_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      toll_stations: {
        Row: {
          created_at: string
          highway: string | null
          id: string
          is_active: boolean
          km_marker: number | null
          location: string
          name: string
          operator_company: string | null
          payment_methods: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          highway?: string | null
          id?: string
          is_active?: boolean
          km_marker?: number | null
          location: string
          name: string
          operator_company?: string | null
          payment_methods?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          highway?: string | null
          id?: string
          is_active?: boolean
          km_marker?: number | null
          location?: string
          name?: string
          operator_company?: string | null
          payment_methods?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      trip_estimates: {
        Row: {
          additional_costs: number | null
          calculation_details: Json | null
          crane_type: string | null
          created_at: string
          created_by: string | null
          destination: string
          distance_km: number | null
          estimated_time_hours: number | null
          fuel_cost: number | null
          id: string
          origin: string
          route_name: string | null
          service_id: string | null
          toll_cost: number | null
          total_estimate: number | null
          vehicle_config: string | null
        }
        Insert: {
          additional_costs?: number | null
          calculation_details?: Json | null
          crane_type?: string | null
          created_at?: string
          created_by?: string | null
          destination: string
          distance_km?: number | null
          estimated_time_hours?: number | null
          fuel_cost?: number | null
          id?: string
          origin: string
          route_name?: string | null
          service_id?: string | null
          toll_cost?: number | null
          total_estimate?: number | null
          vehicle_config?: string | null
        }
        Update: {
          additional_costs?: number | null
          calculation_details?: Json | null
          crane_type?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string
          distance_km?: number | null
          estimated_time_hours?: number | null
          fuel_cost?: number | null
          id?: string
          origin?: string
          route_name?: string | null
          service_id?: string | null
          toll_cost?: number | null
          total_estimate?: number | null
          vehicle_config?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_estimates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_estimates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_estimates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["related_service_id_actual"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_permissions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_enabled: boolean | null
          module_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_enabled?: boolean | null
          module_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_enabled?: boolean | null
          module_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          currency: string
          date_format: string
          id: string
          language: string
          timezone: string
          updated_at: string
          use_system_timezone: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          date_format?: string
          id?: string
          language?: string
          timezone?: string
          updated_at?: string
          use_system_timezone?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          date_format?: string
          id?: string
          language?: string
          timezone?: string
          updated_at?: string
          use_system_timezone?: boolean
          user_id?: string
        }
        Relationships: []
      }
      vehicle_brands: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_brands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_models: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vehicle_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_models_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      orphan_crane_parts_candidates: {
        Row: {
          candidate_cost_id: string | null
          candidate_payment_id: string | null
          cost_amount: number | null
          cost_date: string | null
          cost_desc: string | null
          cost_id: string | null
          created_at: string | null
          paid_date: string | null
          part_id: string | null
          part_name: string | null
          payment_amount: number | null
          payment_desc: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_crane_parts_cost_id"
            columns: ["cost_id"]
            isOneToOne: false
            referencedRelation: "costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_crane_parts_cost_id"
            columns: ["cost_id"]
            isOneToOne: false
            referencedRelation: "orphan_crane_parts_candidates"
            referencedColumns: ["candidate_cost_id"]
          },
        ]
      }
      services_with_excess_summary: {
        Row: {
          calculated_excess_amount: number | null
          client_covered_amount: number | null
          client_id: string | null
          client_name: string | null
          folio: string | null
          has_excess: boolean | null
          id: string | null
          related_client_id: string | null
          related_client_name: string | null
          related_service_folio: string | null
          related_service_id: string | null
          related_service_id_actual: string | null
          related_service_value: number | null
          service_date: string | null
          service_relationship_type: string | null
          value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_related_service_id_fkey"
            columns: ["related_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_related_service_id_fkey"
            columns: ["related_service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_related_service_id_fkey"
            columns: ["related_service_id"]
            isOneToOne: false
            referencedRelation: "services_with_excess_summary"
            referencedColumns: ["related_service_id_actual"]
          },
        ]
      }
    }
    Functions: {
      admin_create_user: {
        Args: {
          p_client_id?: string
          p_email: string
          p_full_name: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      apply_payment_fifo: {
        Args: { p_client_id?: string; p_payment_id: string }
        Returns: Json
      }
      apply_payment_manual: {
        Args: { p_applications: Json; p_payment_id: string }
        Returns: Json
      }
      apply_payment_selective:
        | {
            Args: { p_fiscal_numbers?: string[]; p_payment_id: string }
            Returns: Json
          }
        | {
            Args: {
              p_apply_only_to_specified?: boolean
              p_fiscal_numbers: string[]
              p_payment_id: string
            }
            Returns: Json
          }
      apply_pending_payments_to_invoices: { Args: never; Returns: Json }
      audit_commission_system: { Args: never; Returns: Json }
      backfill_maintenance_costs: { Args: never; Returns: Json }
      backfill_supplier_payments_from_costs: { Args: never; Returns: number }
      build_import_batch_summary: {
        Args: { p_batch_id: string }
        Returns: Json
      }
      calculate_billing_date: {
        Args: {
          billing_cycle_day?: number
          billing_cycle_type: string
          billing_delay_days?: number
          service_date: string
        }
        Returns: string
      }
      can_access_client_sensitive_data: { Args: never; Returns: boolean }
      can_view_notification: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      cascade_delete_cost: {
        Args: { p_cost_id: string }
        Returns: {
          deleted_costs: number
          deleted_crane_parts: number
          deleted_inventory_movements: number
          deleted_supplier_invoices: number
          deleted_supplier_payments: number
        }[]
      }
      check_auth_health: { Args: never; Returns: Json }
      check_bidirectional_sync_status: { Args: never; Returns: Json }
      check_cost_duplicates: {
        Args: {
          p_amount: number
          p_date: string
          p_description: string
          p_folio?: string
          p_tolerance_percent?: number
        }
        Returns: {
          amount: number
          created_at: string
          date: string
          description: string
          id: string
          match_type: string
          service_folio: string
        }[]
      }
      check_for_duplicate_payment: {
        Args: {
          p_amount: number
          p_client_id: string
          p_payment_date: string
          p_tolerance_days?: number
        }
        Returns: Json
      }
      check_inventory_sync_status: { Args: never; Returns: Json }
      check_security_compliance: { Args: never; Returns: Json }
      check_security_status: { Args: never; Returns: string }
      check_service_invoice_consistency: { Args: never; Returns: Json }
      check_supplier_duplicates: {
        Args: { p_name?: string; p_rut: string }
        Returns: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          match_type: string
          name: string
          phone: string
          rut: string
        }[]
      }
      check_supplier_invoice_duplicates: {
        Args: {
          p_amount?: number
          p_folio: string
          p_supplier_rut?: string
          p_tolerance_percent?: number
        }
        Returns: {
          amount: number
          created_at: string
          due_date: string
          id: string
          match_type: string
          reference_number: string
          supplier_id: string
          supplier_name: string
          supplier_rut: string
        }[]
      }
      cleanup_duplicate_inventory_costs: { Args: never; Returns: Json }
      cleanup_duplicate_payments: { Args: never; Returns: Json }
      cleanup_duplicate_profiles: { Args: never; Returns: undefined }
      cleanup_orphaned_supplier_costs: { Args: never; Returns: number }
      cleanup_payment_duplicates: { Args: never; Returns: Json }
      close_service_status_only: {
        Args: { p_service_id: string }
        Returns: Json
      }
      comprehensive_payment_diagnosis: { Args: never; Returns: Json }
      create_automatic_payment_for_invoice:
        | { Args: { p_invoice_id: string }; Returns: Json }
        | {
            Args: { p_invoice_id: string; p_payment_date?: string }
            Returns: Json
          }
      create_cost_with_payment_link: {
        Args: {
          p_amount: number
          p_category: string
          p_cost_category_mapping?: Json
          p_default_category?: string
          p_description: string
          p_paid_date: string
          p_payment_id: string
          p_supplier_name: string
        }
        Returns: Json
      }
      create_inventory_consumption_movement:
        | {
            Args: {
              p_crane_id: string
              p_inventory_item_id: string
              p_observations?: string
              p_operator_id?: string
              p_quantity: number
              p_reference_document?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_crane_id: string
              p_inventory_item_id: string
              p_observations?: string
              p_operator_id?: string
              p_quantity: number
              p_reference_document?: string
              p_unit_cost?: number
            }
            Returns: string
          }
      create_invoice_transaction: {
        Args: { p_invoice_data: Json; p_service_ids: string[] }
        Returns: {
          invoice_folio: string
          invoice_id: string
        }[]
      }
      create_notification: {
        Args: {
          p_action_data?: Json
          p_action_url?: string
          p_category?: string
          p_entity_id?: string
          p_entity_type?: string
          p_group_key?: string
          p_message: string
          p_priority?: number
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: string
      }
      create_payment_from_existing_income: {
        Args: { p_income_id: string }
        Returns: Json
      }
      current_user_role: { Args: never; Returns: string }
      debug_service_states: {
        Args: never
        Returns: {
          current_status: Database["public"]["Enums"]["service_status"]
          invoice_folio: string
          service_folio: string
          should_be_invoiced: boolean
        }[]
      }
      delete_service_cascade: {
        Args: { p_service_id: string }
        Returns: undefined
      }
      delete_user_admin: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      detect_duplicate_crane_parts: {
        Args: { p_crane_id?: string }
        Returns: Json
      }
      diagnose_maintenance_cost_integration: { Args: never; Returns: Json }
      diagnose_mixed_payment_invoices: { Args: never; Returns: Json }
      diagnose_payment_application_conflicts: {
        Args: { p_payment_id?: string }
        Returns: Json
      }
      diagnose_service_update_issues: {
        Args: { service_id_param?: string }
        Returns: Json
      }
      emergency_close_service: { Args: { p_service_id: string }; Returns: Json }
      execute_readonly_query: { Args: { query_text: string }; Returns: Json }
      final_security_check: { Args: never; Returns: Json }
      find_duplicate_suppliers: {
        Args: never
        Returns: {
          id_1: string
          id_2: string
          proveedor_1: string
          proveedor_2: string
          rut_1: string
          rut_2: string
          similitud: number
        }[]
      }
      find_matching_costs_for_invoice: {
        Args: {
          p_amount: number
          p_date_from: string
          p_date_to: string
          p_supplier_rut: string
        }
        Returns: {
          amount: number
          date: string
          description: string
          has_invoice: boolean
          id: string
          payment_date: string
          supplier_name: string
          supplier_payment_id: string
        }[]
      }
      fix_all_invoice_statuses: { Args: never; Returns: Json }
      fix_all_invoiced_services_status: { Args: never; Returns: Json }
      fix_all_maintenance_cost_descriptions: { Args: never; Returns: Json }
      fix_amphos_payment_applications: { Args: never; Returns: Json }
      fix_applied_amount_duplications: { Args: never; Returns: Json }
      fix_duplicate_fact_4011_application: { Args: never; Returns: Json }
      fix_duplicate_paid_amounts: {
        Args: never
        Returns: {
          correct_paid_amount: number
          difference: number
          folio: string
          invoice_id: string
          old_paid_amount: number
        }[]
      }
      fix_existing_invoice_inconsistencies: {
        Args: never
        Returns: {
          invoice_id: string
          new_paid_amount: number
          new_status: Database["public"]["Enums"]["invoice_status"]
          old_paid_amount: number
          old_status: Database["public"]["Enums"]["invoice_status"]
        }[]
      }
      fix_existing_overdue_invoices: { Args: never; Returns: string }
      fix_existing_payment_inconsistencies: {
        Args: never
        Returns: {
          new_applied_amount: number
          new_status: Database["public"]["Enums"]["payment_status"]
          old_applied_amount: number
          old_status: Database["public"]["Enums"]["payment_status"]
          payment_id: string
        }[]
      }
      fix_inventory_cost_issues: { Args: never; Returns: Json }
      fix_invoice_payment_inconsistencies: { Args: never; Returns: Json }
      fix_maintenance_status_inconsistencies: { Args: never; Returns: Json }
      fix_materiales_electricos_unit_cost: { Args: never; Returns: Json }
      fix_negative_remaining_amounts: { Args: never; Returns: Json }
      fix_payment_system_inconsistencies: { Args: never; Returns: Json }
      fix_specific_payment_issue: {
        Args: { p_payment_id?: string }
        Returns: Json
      }
      fix_unlinked_maintenance_costs: { Args: never; Returns: Json }
      force_close_service_bypass_triggers: {
        Args: { p_service_id: string }
        Returns: Json
      }
      force_commission_sync_for_service: {
        Args: { p_service_id: string }
        Returns: Json
      }
      force_frontend_cache_refresh: { Args: never; Returns: Json }
      force_resync_crane_part: { Args: { part_id: string }; Returns: Json }
      force_update_service_to_invoiced: {
        Args: {
          p_invoice_folio: string
          p_numero_fiscal?: string
          p_service_id: string
        }
        Returns: Json
      }
      full_payment_cleanup_and_sync: { Args: never; Returns: Json }
      generate_database_backup: { Args: never; Returns: string }
      generate_excess_folio: { Args: never; Returns: string }
      generate_quick_backup: { Args: never; Returns: Json }
      generate_service_cash_receipt_folio: { Args: never; Returns: string }
      generate_service_folio: { Args: never; Returns: string }
      generate_simple_invoice_folio: { Args: never; Returns: string }
      get_all_users: {
        Args: never
        Returns: {
          client_id: string
          client_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }[]
      }
      get_client_id_for_user: { Args: { user_id: string }; Returns: string }
      get_client_payment_history: {
        Args: { p_client_id: string }
        Returns: Json
      }
      get_commissions_with_details: {
        Args: never
        Returns: {
          amount: number
          client_name: string
          created_at: string
          date: string
          description: string
          id: string
          operator_id: string
          operator_name: string
          operator_rut: string
          payment_batch_id: string
          payment_date: string
          service_date: string
          service_folio: string
          service_id: string
          service_value: number
          subcategory: string
          updated_at: string
        }[]
      }
      get_crane_metrics: { Args: { p_crane_id: string }; Returns: Json }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_current_user_role_safe: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_default_cost_category_id: { Args: never; Returns: string }
      get_document_expiry_alerts: {
        Args: never
        Returns: {
          crane_id: string
          crane_license_plate: string
          days_until_expiry: number
          document_type: string
          expiry_date: string
        }[]
      }
      get_invoice_overdue_stats: { Args: never; Returns: Json }
      get_invoice_payment_status: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      get_invoices_due_soon: {
        Args: { days_ahead?: number }
        Returns: {
          client_name: string
          days_until_due: number
          due_date: string
          folio: string
          id: string
          status: Database["public"]["Enums"]["invoice_status"]
          total: number
        }[]
      }
      get_maintenance_with_cost: {
        Args: { maintenance_id_param: string }
        Returns: {
          cost_amount: number
          cost_date: string
          cost_description: string
          cost_id: string
          maintenance_cost: number
          maintenance_description: string
          maintenance_id: string
          maintenance_status: string
        }[]
      }
      get_notification_summary: {
        Args: never
        Returns: {
          categories: Json
          critical_count: number
          total_count: number
          unread_count: number
        }[]
      }
      get_operator_id_by_user: { Args: { p_user_id: string }; Returns: string }
      get_or_create_inventory_supplier: {
        Args: {
          p_address: string
          p_category: string
          p_contact_person: string
          p_email: string
          p_is_active: boolean
          p_name: string
          p_notes: string
          p_phone: string
          p_rut: string
          p_subcategory: string
        }
        Returns: string
      }
      get_overdue_invoices_for_alerts: {
        Args: never
        Returns: {
          client_name: string
          days_overdue: number
          due_date: string
          folio: string
          id: string
          status: Database["public"]["Enums"]["invoice_status"]
          total: number
        }[]
      }
      get_parts_traceability: {
        Args: { p_crane_id?: string }
        Returns: {
          crane_license_plate: string
          current_stock: number
          inventory_item_id: string
          inventory_item_name: string
          part_id: string
          part_name: string
          purchase_cost: number
          purchase_date: string
          supplier: string
          total_consumed: number
          total_purchased: number
        }[]
      }
      get_supplier_payment_stats: {
        Args: { p_supplier_id: string }
        Returns: {
          count_overdue: number
          count_paid: number
          count_pending: number
          total_overdue: number
          total_paid: number
          total_pending: number
        }[]
      }
      get_supplier_sync_stats: {
        Args: never
        Returns: {
          supplier_name: string
          total_amount_costs: number
          total_amount_inventory: number
          total_amount_paid: number
          total_costs: number
          total_movements: number
          total_payments: number
        }[]
      }
      get_supplier_traceability_stats: {
        Args: { p_supplier_id: string }
        Returns: Json
      }
      get_table_structure: {
        Args: { table_name: string }
        Returns: {
          create_statement: string
        }[]
      }
      get_user_client_id: { Args: never; Returns: string }
      get_user_client_id_safe: { Args: never; Returns: string }
      get_user_role: {
        Args: { user_id?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_role_from_table: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_weighted_average_cost: {
        Args: { p_item_id: string }
        Returns: number
      }
      global_inventory_cleanup: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_xml_batch: { Args: { p_payload: Json }; Returns: Json }
      import_xml_costs: { Args: { p_payload: Json }; Returns: undefined }
      import_xml_supplier_documents: {
        Args: { p_payload: Json }
        Returns: undefined
      }
      insert_notification_if_not_exists: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      is_admin_user:
        | { Args: never; Returns: boolean }
        | { Args: { check_user_id: string }; Returns: boolean }
      is_admin_user_safe: { Args: never; Returns: boolean }
      is_authenticated_admin: { Args: never; Returns: boolean }
      is_authenticated_operator: { Args: never; Returns: boolean }
      is_authenticated_user: { Args: never; Returns: boolean }
      is_authenticated_user_safe: { Args: never; Returns: boolean }
      is_client_user: { Args: never; Returns: boolean }
      is_client_user_safe: { Args: never; Returns: boolean }
      is_operator_assigned_to_service: {
        Args: { _service_id: string }
        Returns: boolean
      }
      is_operator_user: { Args: never; Returns: boolean }
      is_operator_user_safe: { Args: never; Returns: boolean }
      log_audit_entry: {
        Args: {
          p_new_data?: Json
          p_old_data?: Json
          p_operation: string
          p_table_name: string
        }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          additional_data?: Json
          event_description: string
          event_type: string
        }
        Returns: undefined
      }
      log_service_update_error: {
        Args: {
          p_attempted_data?: Json
          p_error_code: string
          p_error_details?: Json
          p_error_message: string
          p_service_id: string
        }
        Returns: undefined
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_costs_paid_batch: {
        Args: { p_cost_ids: string[]; p_payment_date?: string }
        Returns: Json
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      mark_supplier_payment_as_paid: {
        Args: { p_paid_date?: string; p_payment_id: string }
        Returns: boolean
      }
      merge_inventory_items: {
        Args: {
          p_duplicate_item_ids: string[]
          p_master_item_id: string
          p_master_name?: string
        }
        Returns: Json
      }
      merge_suppliers: {
        Args: { p_keep_id: string; p_remove_id: string }
        Returns: Json
      }
      migrate_existing_consumption_movements: { Args: never; Returns: Json }
      migrate_existing_operator_commissions: { Args: never; Returns: undefined }
      migrate_legacy_crane_parts_data: {
        Args: { p_crane_id?: string }
        Returns: Json
      }
      migrate_unsync_crane_parts: { Args: never; Returns: Json }
      migrate_unsynced_crane_parts_to_inventory: { Args: never; Returns: Json }
      preview_next_invoice_folio: { Args: never; Returns: string }
      recalculate_crane_parts_costs: { Args: never; Returns: Json }
      recalculate_payment_balances: { Args: never; Returns: Json }
      reconcile_orphan_records: { Args: never; Returns: Json }
      remove_duplicate_payment_applications: { Args: never; Returns: Json }
      repair_commission_system: { Args: never; Returns: Json }
      repair_payment_application: {
        Args: { p_invoice_id: string; p_payment_id: string }
        Returns: Json
      }
      resolve_commission_conflicts: {
        Args: { p_service_id: string }
        Returns: Json
      }
      resolve_payment_application_conflicts: {
        Args: { p_payment_id?: string }
        Returns: Json
      }
      rollback_import_batch: { Args: { p_batch_id: string }; Returns: Json }
      safe_update_service: {
        Args: { service_id_param: string; update_data: Json }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      smart_apply_payment: {
        Args: { p_auto_apply?: boolean; p_payment_id: string }
        Returns: {
          applications_made: number
          message: string
          remaining_amount: number
          success: boolean
        }[]
      }
      smart_link_maintenance_costs: { Args: never; Returns: Json }
      sync_closure_invoice_status: { Args: never; Returns: Json }
      sync_crane_part_to_inventory: {
        Args: { p_inventory_item_id?: string; p_part_name: string }
        Returns: Json
      }
      sync_existing_paid_invoices: { Args: never; Returns: Json }
      sync_existing_services_to_resources: { Args: never; Returns: undefined }
      sync_existing_supplier_payments_to_costs: { Args: never; Returns: Json }
      sync_maintenance_costs: { Args: never; Returns: string }
      sync_paid_invoices_with_payments: { Args: never; Returns: Json }
      sync_specific_income_to_payment: {
        Args: { p_income_id: string }
        Returns: Json
      }
      test_invoice_creation: { Args: never; Returns: string }
      toggle_user_status: {
        Args: { new_status: boolean; user_id: string }
        Returns: undefined
      }
      trigger_global_data_refresh: { Args: never; Returns: undefined }
      update_closure_status_on_invoice: {
        Args: { p_closure_id: string }
        Returns: undefined
      }
      update_commission_payment_date: {
        Args: {
          p_commission_ids: string[]
          p_payment_batch_id?: string
          p_payment_date?: string
        }
        Returns: Json
      }
      update_overdue_invoices: { Args: never; Returns: undefined }
      update_overdue_supplier_payments: { Args: never; Returns: undefined }
      update_service_comprehensive: {
        Args: { p_service_data: Json; p_service_id: string }
        Returns: Json
      }
      update_services_to_invoiced_batch: {
        Args: {
          p_invoice_folio: string
          p_numero_fiscal?: string
          p_service_ids: string[]
        }
        Returns: Json
      }
      update_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      update_user_role_secure: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      validate_all_warnings_eliminated: { Args: never; Returns: undefined }
      validate_email: { Args: { email: string }; Returns: boolean }
      validate_payment_amounts: {
        Args: never
        Returns: {
          amount: number
          applied_amount: number
          calculated_applied: number
          folio: string
          is_inconsistent: boolean
          payment_id: string
          remaining_amount: number
        }[]
      }
      validate_payment_application_amount: {
        Args: {
          p_excluding_application_id?: string
          p_invoice_id: string
          p_new_amount: number
        }
        Returns: boolean
      }
      validate_payment_system_integrity: { Args: never; Returns: Json }
      validate_product_service_description: {
        Args: { p_text: string }
        Returns: string
      }
      validate_rls_policies: { Args: never; Returns: undefined }
      validate_service_update_data: {
        Args: { p_service_data: Json; p_service_id: string }
        Returns: Json
      }
      verify_auth_system: { Args: never; Returns: Json }
      verify_security_compliance: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "operator" | "viewer" | "client"
      application_method: "fifo" | "manual" | "proportional"
      closure_status:
        | "open"
        | "closed"
        | "invoiced"
        | "quoted"
        | "purchase_order_pending"
      crane_type: "light" | "medium" | "heavy" | "taxi" | "other" | "horquilla"
      invoice_status:
        | "draft"
        | "sent"
        | "paid"
        | "overdue"
        | "cancelled"
        | "partial"
      payment_status: "pending" | "applied" | "partial" | "cancelled"
      service_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "invoiced"
        | "inspection_completed"
        | "quoted"
        | "purchase_order_pending"
        | "with_purchase_order"
        | "failed"
      supplier_category:
        | "combustible"
        | "mantenimiento"
        | "seguros"
        | "otros"
        | "peajes"
        | "salarios"
        | "administrativos"
        | "impuestos"
        | "comision_operador"
      supplier_payment_status: "pending" | "paid" | "overdue" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operator", "viewer", "client"],
      application_method: ["fifo", "manual", "proportional"],
      closure_status: [
        "open",
        "closed",
        "invoiced",
        "quoted",
        "purchase_order_pending",
      ],
      crane_type: ["light", "medium", "heavy", "taxi", "other", "horquilla"],
      invoice_status: [
        "draft",
        "sent",
        "paid",
        "overdue",
        "cancelled",
        "partial",
      ],
      payment_status: ["pending", "applied", "partial", "cancelled"],
      service_status: [
        "pending",
        "in_progress",
        "completed",
        "cancelled",
        "invoiced",
        "inspection_completed",
        "quoted",
        "purchase_order_pending",
        "with_purchase_order",
        "failed",
      ],
      supplier_category: [
        "combustible",
        "mantenimiento",
        "seguros",
        "otros",
        "peajes",
        "salarios",
        "administrativos",
        "impuestos",
        "comision_operador",
      ],
      supplier_payment_status: ["pending", "paid", "overdue", "cancelled"],
    },
  },
} as const
