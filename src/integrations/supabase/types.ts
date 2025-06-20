export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          rut: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          rut: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          rut?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        ]
      }
      company_data: {
        Row: {
          address: string
          alert_days: number | null
          business_name: string
          created_at: string | null
          email: string
          folio_format: string | null
          id: string
          invoice_due_days: number | null
          legal_texts: string | null
          logo_url: string | null
          phone: string
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
          email: string
          folio_format?: string | null
          id?: string
          invoice_due_days?: number | null
          legal_texts?: string | null
          logo_url?: string | null
          phone: string
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
          email?: string
          folio_format?: string | null
          id?: string
          invoice_due_days?: number | null
          legal_texts?: string | null
          logo_url?: string | null
          phone?: string
          rut?: string
          updated_at?: string | null
          vat_percentage?: number | null
          website?: string | null
        }
        Relationships: []
      }
      cost_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      costs: {
        Row: {
          amount: number
          category_id: string
          crane_id: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string
          id: string
          notes: string | null
          operator_id: string | null
          service_folio: string | null
          service_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category_id: string
          crane_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description: string
          id?: string
          notes?: string | null
          operator_id?: string | null
          service_folio?: string | null
          service_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string
          crane_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          notes?: string | null
          operator_id?: string | null
          service_folio?: string | null
          service_id?: string | null
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
          technical_review_expiry: string
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
          technical_review_expiry: string
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
          technical_review_expiry?: string
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
          payment_date: string | null
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
          payment_date?: string | null
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
          payment_date?: string | null
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
        ]
      }
      operators: {
        Row: {
          created_at: string | null
          created_by: string | null
          exam_expiry: string
          id: string
          is_active: boolean | null
          license_number: string
          name: string
          phone: string | null
          rut: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          exam_expiry: string
          id?: string
          is_active?: boolean | null
          license_number: string
          name: string
          phone?: string | null
          rut: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          exam_expiry?: string
          id?: string
          is_active?: boolean | null
          license_number?: string
          name?: string
          phone?: string | null
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
      profiles: {
        Row: {
          avatar_url: string | null
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
      service_closures: {
        Row: {
          client_id: string | null
          created_at: string | null
          created_by: string | null
          date_from: string
          date_to: string
          folio: string
          id: string
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
      service_types: {
        Row: {
          base_price: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          vehicle_info_optional: boolean
        }
        Insert: {
          base_price?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          vehicle_info_optional?: boolean
        }
        Update: {
          base_price?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          vehicle_info_optional?: boolean
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
      services: {
        Row: {
          client_id: string
          crane_id: string
          created_at: string | null
          created_by: string | null
          destination: string
          folio: string
          id: string
          license_plate: string
          observations: string | null
          operator_commission: number | null
          operator_id: string
          origin: string
          purchase_order: string | null
          request_date: string
          service_date: string
          service_type_id: string
          status: Database["public"]["Enums"]["service_status"] | null
          updated_at: string | null
          value: number
          vehicle_brand: string
          vehicle_model: string
        }
        Insert: {
          client_id: string
          crane_id: string
          created_at?: string | null
          created_by?: string | null
          destination: string
          folio: string
          id?: string
          license_plate: string
          observations?: string | null
          operator_commission?: number | null
          operator_id: string
          origin: string
          purchase_order?: string | null
          request_date: string
          service_date: string
          service_type_id: string
          status?: Database["public"]["Enums"]["service_status"] | null
          updated_at?: string | null
          value: number
          vehicle_brand: string
          vehicle_model: string
        }
        Update: {
          client_id?: string
          crane_id?: string
          created_at?: string | null
          created_by?: string | null
          destination?: string
          folio?: string
          id?: string
          license_plate?: string
          observations?: string | null
          operator_commission?: number | null
          operator_id?: string
          origin?: string
          purchase_order?: string | null
          request_date?: string
          service_date?: string
          service_type_id?: string
          status?: Database["public"]["Enums"]["service_status"] | null
          updated_at?: string | null
          value?: number
          vehicle_brand?: string
          vehicle_model?: string
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
            foreignKeyName: "services_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_all_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          email: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          is_active: boolean
          created_at: string
          updated_at: string
        }[]
      }
      get_operator_id_by_user: {
        Args: { p_user_id: string }
        Returns: string
      }
      get_user_role: {
        Args: { user_id?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      toggle_user_status: {
        Args: { user_id: string; new_status: boolean }
        Returns: undefined
      }
      update_user_role: {
        Args: {
          user_id: string
          new_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "operator" | "viewer"
      closure_status: "open" | "closed" | "invoiced"
      crane_type: "light" | "medium" | "heavy" | "taxi" | "other"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      service_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "invoiced"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operator", "viewer"],
      closure_status: ["open", "closed", "invoiced"],
      crane_type: ["light", "medium", "heavy", "taxi", "other"],
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      service_status: [
        "pending",
        "in_progress",
        "completed",
        "cancelled",
        "invoiced",
      ],
    },
  },
} as const
