import { differenceInCalendarDates, parseDateValue } from '@/utils/calendarDate';
import { businessClock } from '@/utils/businessClock';
import {
  DOCUMENT_CATEGORIES,
  PROJECT_TAG_CATEGORY,
  RELATED_ENTITY_TYPES,
  type BusinessDocument,
} from '@/hooks/useBusinessDocuments';

export type DocumentExpiryState = 'none' | 'expired' | 'soon' | 'valid';

/**
 * Estado de vencimiento de un documento respecto al día de negocio.
 * Única fuente para la tarjeta "Vencidos", las filas de la tabla y las
 * carpetas: cualquier contador debe pasar por aquí para que cuadren.
 */
export const getDocumentExpiryState = (expiresAt: string | null): DocumentExpiryState => {
  if (!expiresAt) return 'none';
  const today = businessClock.todayDate();
  today.setHours(0, 0, 0, 0);
  const expiry = parseDateValue(expiresAt);
  const diffDays = differenceInCalendarDates(expiry, today);

  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'soon';
  return 'valid';
};

export const documentCategoryLabel = (value: string) =>
  DOCUMENT_CATEGORIES.find((category) => category.value === value)?.label || value;

export const relatedEntityTypeLabel = (value: string | null) =>
  RELATED_ENTITY_TYPES.find((entity) => entity.value === value)?.label || value || 'Sin relación';

export const UNGROUPED_KEY = '__sin_relacion__';

export const normalizeProjectTag = (value: string) => value.trim().toLowerCase();

/** Primer tag del documento, que en Importaciones es el proyecto. */
export const getDocumentProjectTag = (document: Pick<BusinessDocument, 'tags'>): string | null => {
  const first = (document.tags || []).find((tag) => normalizeProjectTag(tag));
  return first ? normalizeProjectTag(first) : null;
};

/** Tags de proyecto únicos (primer tag) entre los documentos de Importaciones. */
export const collectProjectTags = (documents: ReadonlyArray<Pick<BusinessDocument, 'category' | 'tags'>>) => {
  const tags = new Set<string>();
  for (const document of documents) {
    if (document.category !== PROJECT_TAG_CATEGORY) continue;
    const tag = getDocumentProjectTag(document);
    if (tag) tags.add(tag);
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b, 'es'));
};

export interface DocumentFolderGroup<T extends BusinessDocument = BusinessDocument> {
  key: string;
  label: string;
  /** true para el grupo "Sin relación" / "Sin proyecto", que siempre va al final. */
  ungrouped: boolean;
  documents: T[];
}

export interface DocumentFolderSection<T extends BusinessDocument = BusinessDocument> {
  category: string;
  label: string;
  total: number;
  expired: number;
  soon: number;
  confidential: number;
  /** Las secciones de proyecto agrupan por tag; el resto, por entidad relacionada. */
  groupBy: 'project' | 'entity';
  groups: DocumentFolderGroup<T>[];
}

const categoryOrder = new Map<string, number>(
  DOCUMENT_CATEGORIES.map((category, index) => [category.value, index]),
);

const entityGroupKey = (document: Pick<BusinessDocument, 'related_entity_type' | 'related_entity_id'>) => {
  if (!document.related_entity_type) return UNGROUPED_KEY;
  return `${document.related_entity_type}:${document.related_entity_id || ''}`;
};

const entityGroupLabel = (document: Pick<BusinessDocument, 'related_entity_type' | 'related_entity_id'>) => {
  const typeLabel = relatedEntityTypeLabel(document.related_entity_type);
  if (!document.related_entity_id) return typeLabel;
  return `${typeLabel} · ${document.related_entity_id.slice(0, 8)}`;
};

/**
 * Agrupa en memoria los documentos ya filtrados: categoría → (entidad o
 * proyecto) → documentos. Nunca descarta un documento: los que no tienen
 * entidad/proyecto caen en el grupo "Sin relación"/"Sin proyecto" al final.
 * Conserva el orden de entrada dentro de cada grupo.
 */
export const groupDocumentsIntoFolders = <T extends BusinessDocument>(
  documents: ReadonlyArray<T>,
  expiryStateOf: (expiresAt: string | null) => DocumentExpiryState = getDocumentExpiryState,
): DocumentFolderSection<T>[] => {
  const sections = new Map<string, DocumentFolderSection<T> & { groupMap: Map<string, DocumentFolderGroup<T>> }>();

  for (const document of documents) {
    const category = document.category || 'otros';
    let section = sections.get(category);
    if (!section) {
      section = {
        category,
        label: documentCategoryLabel(category),
        total: 0,
        expired: 0,
        soon: 0,
        confidential: 0,
        groupBy: category === PROJECT_TAG_CATEGORY ? 'project' : 'entity',
        groups: [],
        groupMap: new Map(),
      };
      sections.set(category, section);
    }

    section.total += 1;
    const state = expiryStateOf(document.expires_at);
    if (state === 'expired') section.expired += 1;
    if (state === 'soon') section.soon += 1;
    if (document.is_confidential) section.confidential += 1;

    let key: string;
    let label: string;
    if (section.groupBy === 'project') {
      const projectTag = getDocumentProjectTag(document);
      key = projectTag ?? UNGROUPED_KEY;
      label = projectTag ?? 'Sin proyecto';
    } else {
      key = entityGroupKey(document);
      label = key === UNGROUPED_KEY ? 'Sin relación' : entityGroupLabel(document);
    }

    let group = section.groupMap.get(key);
    if (!group) {
      group = { key, label, ungrouped: key === UNGROUPED_KEY, documents: [] };
      section.groupMap.set(key, group);
      section.groups.push(group);
    }
    group.documents.push(document);
  }

  const ordered = Array.from(sections.values()).sort((a, b) => {
    const orderA = categoryOrder.get(a.category) ?? Number.MAX_SAFE_INTEGER;
    const orderB = categoryOrder.get(b.category) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.label.localeCompare(b.label, 'es');
  });

  return ordered.map(({ groupMap: _groupMap, ...section }) => ({
    ...section,
    groups: [...section.groups].sort((a, b) => {
      if (a.ungrouped !== b.ungrouped) return a.ungrouped ? 1 : -1;
      return a.label.localeCompare(b.label, 'es');
    }),
  }));
};
