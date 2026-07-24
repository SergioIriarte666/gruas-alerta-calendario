import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { createLogger } from "@/lib/logger";

const logger = createLogger("usePortalAccount");

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type BillingContactRow =
  Database["public"]["Tables"]["client_billing_contacts"]["Row"];
type PreferenceRow =
  Database["public"]["Tables"]["client_portal_preferences"]["Row"];

export type PortalCompany = Pick<
  ClientRow,
  | "id"
  | "name"
  | "display_name"
  | "rut"
  | "address"
  | "department"
  | "contact_name"
  | "email"
  | "phone"
  | "is_active"
  | "logo_url"
>;

export type PortalBillingContact = Pick<
  BillingContactRow,
  "id" | "name" | "email" | "phone" | "position" | "is_active"
>;

export type PortalNotificationPreferences = Pick<
  PreferenceRow,
  | "service_updates"
  | "request_updates"
  | "purchase_order_alerts"
  | "invoice_alerts"
  | "email_enabled"
  | "portal_enabled"
>;

export const DEFAULT_PORTAL_PREFERENCES: PortalNotificationPreferences = {
  service_updates: true,
  request_updates: true,
  purchase_order_alerts: true,
  invoice_alerts: true,
  email_enabled: true,
  portal_enabled: true,
};

export const usePortalAccount = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const accountQueryKey = ["portal-account", user?.client_id];
  const preferencesQueryKey = ["portal-account-preferences", user?.id];

  const accountQuery = useQuery({
    queryKey: accountQueryKey,
    queryFn: async () => {
      const [companyResult, contactsResult] = await Promise.all([
        supabase
          .from("clients")
          .select(
            "id, name, display_name, rut, address, department, contact_name, email, phone, is_active, logo_url",
          )
          .eq("id", user!.client_id!)
          .single(),
        supabase
          .from("client_billing_contacts")
          .select("id, name, email, phone, position, is_active")
          .eq("client_id", user!.client_id!)
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      if (companyResult.error) {
        logger.error("No se pudo cargar la empresa del portal", companyResult.error);
        throw companyResult.error;
      }

      if (contactsResult.error) {
        logger.warn(
          "No se pudieron cargar los contactos de facturación",
          contactsResult.error,
        );
      }

      return {
        company: companyResult.data as PortalCompany,
        billingContacts: (contactsResult.data ?? []) as PortalBillingContact[],
      };
    },
    enabled: Boolean(user?.client_id && user.role === "client"),
    staleTime: 5 * 60 * 1000,
  });

  const preferencesQuery = useQuery({
    queryKey: preferencesQueryKey,
    queryFn: async (): Promise<PortalNotificationPreferences> => {
      const { data, error } = await supabase
        .from("client_portal_preferences")
        .select(
          "service_updates, request_updates, purchase_order_alerts, invoice_alerts, email_enabled, portal_enabled",
        )
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) {
        logger.error("No se pudieron cargar las preferencias del portal", error);
        throw error;
      }

      return data ?? DEFAULT_PORTAL_PREFERENCES;
    },
    enabled: Boolean(user?.id && user.role === "client"),
  });

  const savePreferences = useMutation({
    mutationFn: async (preferences: PortalNotificationPreferences) => {
      if (!user?.id) throw new Error("No hay una sesión de cliente activa");
      if (!preferences.email_enabled && !preferences.portal_enabled) {
        throw new Error("Debes mantener al menos un canal de notificación");
      }

      const { data, error } = await supabase
        .from("client_portal_preferences")
        .upsert(
          {
            user_id: user.id,
            ...preferences,
          },
          { onConflict: "user_id" },
        )
        .select(
          "service_updates, request_updates, purchase_order_alerts, invoice_alerts, email_enabled, portal_enabled",
        )
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(preferencesQueryKey, preferences);
      toast.success("Preferencias guardadas", {
        description: "Actualizamos la forma en que deseas recibir avisos.",
      });
    },
    onError: (error: Error) => {
      logger.error("No se pudieron guardar las preferencias", error);
      toast.error("No se guardaron las preferencias", {
        description: error.message || "Inténtalo nuevamente.",
      });
    },
  });

  return {
    company: accountQuery.data?.company ?? null,
    billingContacts: accountQuery.data?.billingContacts ?? [],
    isLoadingAccount: accountQuery.isLoading,
    accountError: accountQuery.error,
    preferences:
      preferencesQuery.data ?? DEFAULT_PORTAL_PREFERENCES,
    isLoadingPreferences: preferencesQuery.isLoading,
    preferencesError: preferencesQuery.error,
    savePreferences,
  };
};
