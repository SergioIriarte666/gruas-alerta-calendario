import { useMemo } from 'react';
import { FileText, Folder, FolderOpen, Lock, Tag } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { BusinessDocument } from '@/hooks/useBusinessDocuments';
import { getDocumentExpiryState, groupDocumentsIntoFolders, type DocumentFolderSection } from '@/utils/businessDocuments';
import {
  DocumentExpiryBadge,
  DocumentRowActions,
  formatDocumentDate,
  type DocumentRowActionHandlers,
} from './DocumentRowActions';

interface DocumentsFolderViewProps extends DocumentRowActionHandlers {
  documents: BusinessDocument[];
  isLoading: boolean;
}

const SectionSummary = ({ section }: { section: DocumentFolderSection }) => (
  <div className="flex min-w-0 flex-1 items-center gap-3 pr-2 text-left">
    <div className="rounded-lg border border-border/70 bg-muted/40 p-2">
      <Folder className="size-4 text-primary" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate font-semibold text-foreground">{section.label}</p>
      <p className="text-xs font-normal text-muted-foreground">
        {section.total} {section.total === 1 ? 'documento' : 'documentos'} · {section.groups.length}{' '}
        {section.groupBy === 'project' ? (section.groups.length === 1 ? 'proyecto' : 'proyectos') : (section.groups.length === 1 ? 'grupo' : 'grupos')}
      </p>
    </div>
    <div className="flex shrink-0 flex-wrap justify-end gap-1">
      {section.expired > 0 && (
        <Badge className="border-danger/30 bg-danger/10 text-danger hover:bg-danger/10">{section.expired} vencido{section.expired === 1 ? '' : 's'}</Badge>
      )}
      {section.soon > 0 && (
        <Badge className="border-warning/30 bg-warning/10 text-warning hover:bg-warning/10">{section.soon} por vencer</Badge>
      )}
      {section.confidential > 0 && (
        <Badge variant="outline" className="gap-1"><Lock className="size-3" />{section.confidential}</Badge>
      )}
    </div>
  </div>
);

const DocumentItem = ({ document, ...handlers }: { document: BusinessDocument } & DocumentRowActionHandlers) => (
  <li
    className={cn(
      'flex flex-col gap-2 rounded-lg border border-border/60 bg-background/60 p-3 sm:flex-row sm:items-center sm:gap-3',
      getDocumentExpiryState(document.expires_at) === 'expired' && 'border-danger/30 bg-danger/5',
    )}
  >
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <div className="mt-0.5 shrink-0 rounded-lg border border-border/70 bg-muted/40 p-2">
        <FileText className="size-4 text-primary" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-foreground">{document.title}</p>
          {document.is_confidential && <Lock className="size-3.5 shrink-0 text-warning" aria-label="Confidencial" />}
        </div>
        {document.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{document.description}</p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          Fecha: {formatDocumentDate(document.document_date)} · {document.file_name}
        </p>
        {document.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {document.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="px-1.5 py-0 text-xs">{tag}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
    <div className="flex items-center justify-between gap-3 sm:justify-end">
      <div className="flex flex-col items-start gap-0.5 sm:items-end">
        <DocumentExpiryBadge expiresAt={document.expires_at} />
        {document.expires_at && (
          <span className="text-xs text-muted-foreground">{formatDocumentDate(document.expires_at)}</span>
        )}
      </div>
      <DocumentRowActions document={document} {...handlers} />
    </div>
  </li>
);

/**
 * Vista "Carpetas": secciones colapsables por categoría y, dentro, un
 * subgrupo por entidad relacionada (o por tag de proyecto en Importaciones).
 * Recibe la misma lista ya filtrada que la tabla; sólo cambia el render.
 */
export const DocumentsFolderView = ({ documents, isLoading, ...handlers }: DocumentsFolderViewProps) => {
  const sections = useMemo(() => groupDocumentsIntoFolders(documents), [documents]);

  if (isLoading) {
    return (
      <div className="grid gap-3 border-t border-border/70 p-4">
        {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="border-t border-border/70 p-4">
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay documentos para los filtros seleccionados.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Accordion
      type="multiple"
      defaultValue={sections.map((section) => section.category)}
      className="border-t border-border/70 px-4 sm:px-6"
    >
      {sections.map((section) => (
        <AccordionItem key={section.category} value={section.category} className="border-border/70">
          <AccordionTrigger className="py-3 hover:no-underline">
            <SectionSummary section={section} />
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            {section.groups.map((group) => (
              <div key={group.key} className="space-y-2">
                <div className="flex items-center gap-2 pl-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {section.groupBy === 'project' && !group.ungrouped
                    ? <Tag className="size-3.5" />
                    : <FolderOpen className="size-3.5" />}
                  <span className="truncate normal-case tracking-normal">{group.label}</span>
                  <span className="rounded-full bg-muted px-1.5 py-0 text-xs text-muted-foreground">{group.documents.length}</span>
                </div>
                <ul className="space-y-2">
                  {group.documents.map((document) => (
                    <DocumentItem key={document.id} document={document} {...handlers} />
                  ))}
                </ul>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};
