export const DEDUPE_SENTINEL_DATE = "2000-01-01";

export interface DedupeAcquireResult {
  acquired: boolean;
  duplicate?: boolean;
  error?: string;
}

export const notificationDedupeKey = (kind: string, id: string): string => `${kind}:${id}`;

export async function acquireNotificationDedupe(
  admin: { from: (table: string) => any },
  alertKey: string,
  context: Record<string, unknown> = {},
): Promise<DedupeAcquireResult> {
  const { error } = await admin
    .from("whatsapp_alert_dedupe")
    .insert({
      alert_key: alertKey,
      sent_for_date: DEDUPE_SENTINEL_DATE,
      context,
    });

  if (!error) return { acquired: true };
  if ((error as { code?: string }).code === "23505") {
    return { acquired: false, duplicate: true };
  }

  return { acquired: false, error: error.message };
}

export async function releaseNotificationDedupe(
  admin: { from: (table: string) => any },
  alertKey: string,
): Promise<void> {
  const { error } = await admin
    .from("whatsapp_alert_dedupe")
    .delete()
    .eq("alert_key", alertKey)
    .eq("sent_for_date", DEDUPE_SENTINEL_DATE);

  if (error) {
    console.warn("[dedupe] No se pudo liberar dedupe:", alertKey, error.message);
  }
}
