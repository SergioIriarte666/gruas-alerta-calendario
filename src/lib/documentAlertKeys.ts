export type DocumentAlertCadenceStatus = 'por_vencer' | 'vencido';

export function getOperatorDocumentAlertKey(
  documentId: string,
  status: DocumentAlertCadenceStatus,
) {
  return status === 'vencido'
    ? `operator_doc_vencido:${documentId}`
    : `operator_doc_expiry:${documentId}`;
}

export function getCraneDocumentAlertKey(
  documentId: string,
  status: DocumentAlertCadenceStatus,
) {
  return status === 'vencido'
    ? `crane_doc_vencido:${documentId}`
    : `crane_doc_expiry:${documentId}`;
}
