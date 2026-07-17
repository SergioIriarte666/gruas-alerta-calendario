import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Paperclip, FileText } from 'lucide-react';
import { useServiceEvidence, useUploadEvidence } from '@/hooks/useExternalServiceClosure';
import {
  EVIDENCE_TYPE_LABELS,
  type ExternalEvidenceType,
} from '@/types/externalServices';

interface Props {
  serviceId: string;
  readOnly?: boolean;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const EvidenceUploadCard = ({ serviceId, readOnly = false }: Props) => {
  const { data: evidences = [], isLoading } = useServiceEvidence(serviceId);
  const upload = useUploadEvidence();
  const inputRef = useRef<HTMLInputElement>(null);
  const [evidenceType, setEvidenceType] = useState<ExternalEvidenceType>('formulario_tercero');
  const [notes, setNotes] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleUpload = async () => {
    if (!pendingFile) return;
    try {
      await upload.mutateAsync({
        serviceId,
        file: pendingFile,
        evidenceType,
        notes: notes.trim() || undefined,
      });
      setPendingFile(null);
      setNotes('');
      if (inputRef.current) inputRef.current.value = '';
    } catch {
      // no-op: onError already handled it
    }
  };

  return (
    <Card className="external-dialog-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="size-4" />
          Evidencia del tercero
          <Badge variant="secondary" className="ml-1">{evidences.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && (
          <div className="space-y-3 rounded-md border border-dashed p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Tipo de evidencia</Label>
                <Select value={evidenceType} onValueChange={(v) => setEvidenceType(v as ExternalEvidenceType)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVIDENCE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Archivo</Label>
                <Input
                  ref={inputRef}
                  type="file"
                  className="mt-1"
                  accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Información adicional sobre este archivo..."
                className="mt-1 min-h-[60px]"
              />
            </div>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!pendingFile || upload.isPending}
              size="sm"
              className="w-full sm:w-auto"
            >
              <Upload className="mr-2 size-4" />
              {upload.isPending ? 'Subiendo...' : 'Subir archivo'}
            </Button>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando evidencia...</p>
        ) : evidences.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No hay archivos cargados aún.</p>
        ) : (
          <div className="space-y-2">
            {evidences.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-3 rounded-md border bg-muted/30 p-3"
              >
                <FileText className="size-4 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{ev.fileName}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {EVIDENCE_TYPE_LABELS[ev.evidenceType]} · {formatSize(ev.fileSize)}
                  </div>
                  {ev.notes && (
                    <div className="mt-1 text-xs italic text-muted-foreground">{ev.notes}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
