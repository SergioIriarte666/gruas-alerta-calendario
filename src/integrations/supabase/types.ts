export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      costs: {
        Row: {
          id: string
          created_at: string
          amount: number
          category_id: string
          date: string
          description: string
          notes: string | null
          subcategory: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          amount: number
          category_id: string
          date: string
          description: string
          notes?: string | null
          subcategory?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          amount?: number
          category_id?: string
          date?: string
          description?: string
          notes?: string | null
          subcategory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "costs_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "cost_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      cost_inventory_items: {
        Row: {
          id: string
          created_at: string
          cost_id: string
          inventory_item_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          id?: string
          created_at?: string
          cost_id: string
          inventory_item_id: string
          quantity: number
          unit_cost: number
        }
        Update: {
          id?: string
          created_at?: string
          cost_id?: string
          inventory_item_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_inventory_items_cost_id_fkey"
            columns: ["cost_id"]
            referencedRelation: "costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_inventory_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          }
        ]
      }
      suppliers: {
        Row: {
          id: string
          created_at: string
          name: string
          rut: string
          email: string | null
          phone: string | null
          address: string | null
          contact_name: string | null
          category: string
          notes: string | null
          is_active: boolean
          created_by: string | null
          updated_by: string | null
          updated_at: string | null
          payment_terms: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          rut: string
          email?: string | null
          phone?: string | null
          address?: string | null
          contact_name?: string | null
          category: string
          notes?: string | null
          is_active?: boolean
          created_by?: string | null
          updated_by?: string | null
          updated_at?: string | null
          payment_terms?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          rut?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          contact_name?: string | null
          category?: string
          notes?: string | null
          is_active?: boolean
          created_by?: string | null
          updated_by?: string | null
          updated_at?: string | null
          payment_terms?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      supplier_invoices: {
        Row: {
          id: string
          created_at: string
          supplier_id: string | null
          invoice_number: string
          issue_date: string
          due_date: string
          amount: number
          currency: string | null
          status: string | null
          description: string | null
          tax_amount: number | null
          net_amount: number
          payment_terms: number | null
          paid_amount: number | null
          balance: number | null
          updated_at: string | null
          created_by: string | null
          updated_by: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          supplier_id?: string | null
          invoice_number: string
          issue_date: string
          due_date: string
          amount: number
          currency?: string | null
          status?: string | null
          description?: string | null
          tax_amount?: number | null
          net_amount: number
          payment_terms?: number | null
          paid_amount?: number | null
          balance?: number | null
          updated_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          supplier_id?: string | null
          invoice_number?: string
          issue_date?: string
          due_date?: string
          amount?: number
          currency?: string | null
          status?: string | null
          description?: string | null
          tax_amount?: number | null
          net_amount?: number
          payment_terms?: number | null
          paid_amount?: number | null
          balance?: number | null
          updated_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }
      supplier_payments: {
        Row: {
          id: string
          created_at: string
          supplier_id: string | null
          amount: number
          payment_date: string
          payment_method: string | null
          reference_number: string | null
          status: string
          notes: string | null
          due_date: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          supplier_id?: string | null
          amount: number
          payment_date: string
          payment_method?: string | null
          reference_number?: string | null
          status: string
          notes?: string | null
          due_date?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          supplier_id?: string | null
          amount?: number
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
          status?: string
          notes?: string | null
          due_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }
      inventory_movements: {
        Row: {
          id: string
          created_at: string
          item_id: string | null
          location_id: string | null
          movement_type: string
          quantity: number
          unit_cost: number | null
          total_cost: number | null
          movement_date: string
          observations: string | null
          supplier_id: string | null
          reference_document: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          item_id?: string | null
          location_id?: string | null
          movement_type: string
          quantity: number
          unit_cost?: number | null
          total_cost?: number | null
          movement_date?: string
          observations?: string | null
          supplier_id?: string | null
          reference_document?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          item_id?: string | null
          location_id?: string | null
          movement_type?: string
          quantity?: number
          unit_cost?: number | null
          total_cost?: number | null
          movement_date?: string
          observations?: string | null
          supplier_id?: string | null
          reference_document?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_location_id_fkey"
            columns: ["location_id"]
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }
      inventory_items: {
        Row: {
          id: string
          created_at: string
          name: string
          sku: string | null
          description: string | null
          unit_of_measure: string
          min_stock: number
          current_stock: number
          category_id: string | null
          barcode: string | null
          cost_price: number | null
          sale_price: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          sku?: string | null
          description?: string | null
          unit_of_measure?: string
          min_stock?: number
          current_stock?: number
          category_id?: string | null
          barcode?: string | null
          cost_price?: number | null
          sale_price?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          sku?: string | null
          description?: string | null
          unit_of_measure?: string
          min_stock?: number
          current_stock?: number
          category_id?: string | null
          barcode?: string | null
          cost_price?: number | null
          sale_price?: number | null
        }
        Relationships: []
      }
      inventory_locations: {
        Row: {
          id: string
          created_at: string
          name: string
          description: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          description?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          description?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      crane_parts: {
        Row: {
          id: string
          created_at: string
          part_name: string
          quantity: number
          unit_price: number
          total_value: number | null
          date: string
          crane_id: string | null
          supplier_id: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          part_name: string
          quantity: number
          unit_price: number
          total_value?: number | null
          date: string
          crane_id?: string | null
          supplier_id?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          part_name?: string
          quantity?: number
          unit_price?: number
          total_value?: number | null
          date?: string
          crane_id?: string | null
          supplier_id?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crane_parts_crane_id_fkey"
            columns: ["crane_id"]
            referencedRelation: "cranes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crane_parts_supplier_id_fkey"
            columns: ["supplier_id"]
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }
      cranes: {
        Row: {
          id: string
          created_at: string
          brand: string
          model: string
          license_plate: string
          year: number
          status: string
        }
        Insert: {
          id?: string
          created_at?: string
          brand: string
          model: string
          license_plate: string
          year: number
          status: string
        }
        Update: {
          id?: string
          created_at?: string
          brand?: string
          model?: string
          license_plate?: string
          year?: number
          status?: string
        }
        Relationships: []
      }
      cost_categories: {
        Row: {
          id: string
          created_at: string
          name: string
          description: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          description?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          description?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_: string]: never
    }
    Functions: {
      [_: string]: never
    }
    Enums: {
      [_: string]: never
    }
    CompositeTypes: {
      [_: string]: never
    }
  }
}
