export interface EmailNotificationGateResult {
  enabled: boolean;
  settings: Record<string, unknown> | null;
}

export async function getEmailNotificationGate(
  admin: { from: (table: string) => any },
): Promise<EmailNotificationGateResult> {
  const { data, error } = await admin
    .from("notification_email_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[email-settings] No se pudo leer notification_email_settings:", error.message);
    return { enabled: true, settings: null };
  }

  const settings = (data as Record<string, unknown> | null) ?? null;
  return {
    enabled: !(settings && settings.email_enabled === false),
    settings,
  };
}

export function getInspectionEmailSkipReason(
  kind: "inspection_email" | "delivery_email",
  gate: EmailNotificationGateResult,
): string | null {
  if (!gate.enabled) return "email_disabled";
  if (kind === "inspection_email" && gate.settings?.send_inspection_completed === false) {
    return "send_inspection_completed_email_disabled";
  }
  if (kind === "delivery_email" && gate.settings?.send_vehicle_pickup === false) {
    return "send_vehicle_pickup_email_disabled";
  }
  return null;
}
