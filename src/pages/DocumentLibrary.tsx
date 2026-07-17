import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  CalendarIcon,
  Download,
  Edit,
  File,
  FileCheck2,
  FileText,
  FilterX,
  Loader2,
  Lock,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetricCard } from '@/components/ui/metric-card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SectionCard } from '@/components/ui/section-card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  BusinessDocument,
  BusinessDocumentFilters,
  BusinessDocumentMetadata,
  DOCUMENT_CATEGORIES,
  RELATED_ENTITY_TYPES,
  useBusinessDocuments,
  validateBusinessDocumentFile,
} from '@/hooks/useBusinessDocuments';
import { useUser } from '@/contexts/UserContext';
import { useReAuth } from '@/hooks/useReAuth';
import { cn } from '@/lib/utils';
import { createLocalDateFromCalendar } from '@/utils/timezoneUtils';

const DEFAULT_FORM: BusinessDocumentMetadata = {
  title: '',
  description: '',
  category: 'otros',
  tags: [],
  related_entity_type: null,
  related_entity_id: null,
  document_date: null,
  expires_at: null,
  is_confidential: false,
};

const expiryFilters = [
  { value: 'all', label: 'Todos' },
  { value: 'expired', label: 'Vencidos' },
  { value: 'soon', label: 'Por vencer' },
  { value: 'valid', label: 'Vigentes' },
  { value: 'no_expiry', label: 'Sin vencimiento' },
] as const;

const categoryLabel = (value: string) =>
  DOCUMENT_CATEGORIES.find((category) => category.value === value)?.label || value;

const relatedEntityLabel = (value: string | null) =>
  RELATED_ENTITY_TYPES.find((entity) => entity.value === value)?.label || value || 'Sin relación';

const formatDate = (value: string | null) => {
  if (!value) return '-';
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-CL');
};

const parseDateValue = (value?: string | null) => {
  if (!value) return undefined;
  return new Date(`${value}T12:00:00`);
};

const toDateValue = (date?: Date) => {
  if (!date) return '';
  const localDate = createLocalDateFromCalendar(date);
  return format(localDate, 'yyyy-MM-dd');
};

const DatePickerButton = ({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: (date: Date) => boolean;
}) => {
  const selectedDate = parseDateValue(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !selectedDate && 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {selectedDate ? format(selectedDate, 'dd/MM/yyyy', { locale: es }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => onChange(toDateValue(date))}
          disabled={disabled}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
};

const formatBytes = (bytes: number | null) => {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getExpiryState = (expiresAt: string | null) => {
  if (!expiresAt) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${expiresAt}T12:00:00`);
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'soon';
  return 'valid';
};

const expiryBadge = (expiresAt: string | null) => {
  const state = getExpiryState(expiresAt);
  if (state === 'expired') {
    return <Badge className="border-danger/30 bg-danger/10 text-danger hover:bg-danger/10">Vencido</Badge>;
  }
  if (state === 'soon') {
    return <Badge className="border-warning/30 bg-warning/10 text-warning hover:bg-warning/10">Por vencer</Badge>;
  }
  if (state === 'valid') {
    return <Badge className="border-success/30 bg-success/10 text-success hover:bg-success/10">Vigente</Badge>;
  }
  return <Badge variant="outline">Sin vencimiento</Badge>;
};

const DocumentLibrary = () => {
  const { user } = useUser();
  const { verifyPassword } = useReAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expiry, setExpiry] = useState<BusinessDocumentFilters['expiry']>('all');
  const [confidentiality, setConfidentiality] = useState<BusinessDocumentFilters['confidentiality']>('all');
  const [relatedEntityType, setRelatedEntityType] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<BusinessDocument | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<BusinessDocument | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState<BusinessDocumentMetadata>(DEFAULT_FORM);
  const [tagsText, setTagsText] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState('');
  const [verifyingDelete, setVerifyingDelete] = useState(false);

  const filters = useMemo<BusinessDocumentFilters>(() => ({
    search,
    category,
    dateFrom,
    dateTo,
    expiry,
    confidentiality,
    relatedEntityType,
  }), [category, confidentiality, dateFrom, dateTo, expiry, relatedEntityType, search]);

  const {
    documents,
    isLoading,
    isFetching,
    uploadDocument,
    updateDocument,
    deleteDocument,
    getSignedUrl,
    uploading,
    updating,
    deleting,
  } = useBusinessDocuments(filters);

  const canManageConfidential = user?.role === 'admin';

  const metrics = useMemo(() => {
    const expired = documents.filter((document) => getExpiryState(document.expires_at) === 'expired').length;
    const soon = documents.filter((document) => getExpiryState(document.expires_at) === 'soon').length;
    const confidential = documents.filter((document) => document.is_confidential).length;

    return { total: documents.length, expired, soon, confidential };
  }, [documents]);

  useEffect(() => {
    document.title = 'Biblioteca Documental | Panel';
    const description = 'Biblioteca documental para respaldos, contratos, permisos y archivos del negocio.';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', description);
    else {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = description;
      document.head.appendChild(m);
    }
  }, []);

  useEffect(() => {
    if (documentToDelete) {
      setDeletePassword('');
      setDeletePasswordError('');
      setVerifyingDelete(false);
    }
  }, [documentToDelete]);

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setTagsText('');
    setSelectedFile(null);
    setEditingDocument(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openCreateForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEditForm = (document: BusinessDocument) => {
    setEditingDocument(document);
    setSelectedFile(null);
    setTagsText((document.tags || []).join(', '));
    setForm({
      title: document.title,
      description: document.description || '',
      category: document.category,
      tags: document.tags || [],
      related_entity_type: document.related_entity_type,
      related_entity_id: document.related_entity_id,
      document_date: document.document_date,
      expires_at: document.expires_at,
      is_confidential: document.is_confidential,
    });
    setIsFormOpen(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    try {
      validateBusinessDocumentFile(file);
      setSelectedFile(file);
      if (!form.title) {
        setForm((current) => ({ ...current, title: file.name.replace(/\.[^/.]+$/, '') }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Archivo no válido';
      toast.error(message);
      setSelectedFile(null);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }

    if (!editingDocument && !selectedFile) {
      toast.error('Selecciona un archivo para subir');
      return;
    }

    if (form.is_confidential && !canManageConfidential) {
      toast.error('Solo administradores pueden gestionar documentos confidenciales');
      return;
    }

    const metadata = {
      ...form,
      tags: tagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
      related_entity_type: form.related_entity_type || null,
      related_entity_id: form.related_entity_id?.trim() || null,
      document_date: form.document_date || null,
      expires_at: form.expires_at || null,
    };

    try {
      if (editingDocument) {
        await updateDocument({ id: editingDocument.id, metadata });
      } else if (selectedFile) {
        await uploadDocument({ file: selectedFile, metadata });
      }

      setIsFormOpen(false);
      resetForm();
    } catch {
      // no-op: onError already handled it
    }
  };

  const handleDownload = async (document: BusinessDocument) => {
    setDownloadingId(document.id);
    try {
      const signedUrl = await getSignedUrl(document);
      const link = window.document.createElement('a');
      link.href = signedUrl;
      link.download = document.file_name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo descargar el documento';
      toast.error(message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    if (!deletePassword.trim()) {
      setDeletePasswordError('Ingrese su contraseña');
      return;
    }

    setVerifyingDelete(true);
    setDeletePasswordError('');

    try {
      await verifyPassword(deletePassword);
    } catch {
      setDeletePasswordError('Error al verificar contraseña');
      setVerifyingDelete(false);
      return;
    }

    setVerifyingDelete(false);
    try {
      await deleteDocument(documentToDelete.id);
      setDocumentToDelete(null);
    } catch {
      // no-op: onError already handled it
    }
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('all');
    setDateFrom('');
    setDateTo('');
    setExpiry('all');
    setConfidentiality('all');
    setRelatedEntityType('all');
  };

  return (
    <div className="document-library-concept space-y-6 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="dashboard-section-kicker">
            <Archive className="size-3.5" />
            Archivo operativo
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="dashboard-section-title">Biblioteca documental</h1>
            {isFetching && !isLoading && <Badge variant="outline">Actualizando</Badge>}
          </div>
          <p className="dashboard-section-description">Contratos, permisos, seguros y respaldos críticos con trazabilidad.</p>
        </div>
        <Button onClick={openCreateForm} size="sm" className="dashboard-report-button gap-2">
          <Plus className="size-4" />
          Subir documento
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)
        ) : (
          <>
            <MetricCard title="Documentos" value={metrics.total} description="Activos en biblioteca" icon={Archive} tone="primary" variant="control" />
            <MetricCard title="Por vencer" value={metrics.soon} description="Vencen en los próximos 30 días" icon={CalendarClock} tone="warning" variant="control" />
            <MetricCard title="Vencidos" value={metrics.expired} description="Requieren revisión" icon={AlertTriangle} tone="danger" variant="control" />
            <MetricCard title="Confidenciales" value={metrics.confidential} description="Con control especial" icon={Lock} tone="info" variant="control" />
          </>
        )}
      </div>

      <SectionCard flush className="operations-panel border-border/70 bg-card/80 shadow-sm">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.3fr)_repeat(5,minmax(150px,1fr))_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar título, descripción o archivo"
                className="pl-9"
              />
            </div>

            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {DOCUMENT_CATEGORIES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={expiry} onValueChange={(value) => setExpiry(value as BusinessDocumentFilters['expiry'])}>
              <SelectTrigger>
                <SelectValue placeholder="Vencimiento" />
              </SelectTrigger>
              <SelectContent>
                {expiryFilters.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={confidentiality} onValueChange={(value) => setConfidentiality(value as BusinessDocumentFilters['confidentiality'])}>
              <SelectTrigger>
                <SelectValue placeholder="Confidencialidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="public">No confidenciales</SelectItem>
                <SelectItem value="confidential">Confidenciales</SelectItem>
              </SelectContent>
            </Select>

            <Select value={relatedEntityType} onValueChange={setRelatedEntityType}>
              <SelectTrigger>
                <SelectValue placeholder="Entidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las entidades</SelectItem>
                {RELATED_ENTITY_TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters} className="gap-2">
              <FilterX className="size-4" />
              Limpiar
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="date-from">Fecha documento desde</Label>
              <DatePickerButton
                value={dateFrom}
                onChange={setDateFrom}
                placeholder="Seleccionar fecha"
                disabled={(date) => Boolean(dateTo && date > parseDateValue(dateTo)!)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date-to">Fecha documento hasta</Label>
              <DatePickerButton
                value={dateTo}
                onChange={setDateTo}
                placeholder="Seleccionar fecha"
                disabled={(date) => Boolean(dateFrom && date < parseDateValue(dateFrom)!)}
              />
            </div>
          </div>
        </div>

        <div className="hidden overflow-x-auto border-t border-border/70 md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={7}><Skeleton className="h-10 rounded-lg" /></TableCell>
                  </TableRow>
                ))
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                    No hay documentos para los filtros seleccionados.
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((document) => (
                  <TableRow
                    key={document.id}
                    className={cn(getExpiryState(document.expires_at) === 'expired' && 'bg-danger/5')}
                  >
                    <TableCell>
                      <div className="flex min-w-[220px] items-start gap-3">
                        <div className="mt-0.5 rounded-lg border border-border/70 bg-muted/40 p-2">
                          <FileText className="size-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium text-foreground">{document.title}</p>
                            {document.is_confidential && <Lock className="size-3.5 text-warning" />}
                          </div>
                          {document.description && (
                            <p className="line-clamp-1 text-xs text-muted-foreground">{document.description}</p>
                          )}
                          {document.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {document.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="outline" className="px-1.5 py-0 text-[10px]">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{categoryLabel(document.category)}</TableCell>
                    <TableCell>{relatedEntityLabel(document.related_entity_type)}</TableCell>
                    <TableCell>{formatDate(document.document_date)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {expiryBadge(document.expires_at)}
                        <p className="text-xs text-muted-foreground">{formatDate(document.expires_at)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="max-w-[180px] truncate">{document.file_name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(document.file_size)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(document)}
                          disabled={downloadingId === document.id}
                          title="Descargar"
                        >
                          {downloadingId === document.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditForm(document)} title="Editar">
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDocumentToDelete(document)}
                          className="text-destructive hover:text-destructive"
                          title="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 border-t border-border/70 p-4 md:hidden">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-xl" />)
          ) : documents.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No hay documentos para los filtros seleccionados.
              </CardContent>
            </Card>
          ) : (
            documents.map((document) => (
              <Card key={document.id} className={cn('operations-panel border-border/70', getExpiryState(document.expires_at) === 'expired' && 'border-danger/30 bg-danger/5')}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{document.title}</p>
                        {document.is_confidential && <Lock className="size-3.5 shrink-0 text-warning" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{categoryLabel(document.category)} · {formatBytes(document.file_size)}</p>
                    </div>
                    {expiryBadge(document.expires_at)}
                  </div>
                  {document.description && <p className="line-clamp-2 text-sm text-muted-foreground">{document.description}</p>}
                  <div className="flex flex-wrap gap-1">
                    {document.tags.map((tag) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Fecha: {formatDate(document.document_date)}</span>
                    <span>Vence: {formatDate(document.expires_at)}</span>
                    <span className="col-span-2 truncate">Archivo: {document.file_name}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleDownload(document)} className="flex-1 gap-2">
                      <Download className="size-4" />
                      Descargar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditForm(document)}>
                      <Edit className="size-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDocumentToDelete(document)} className="text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </SectionCard>

      <Dialog open={isFormOpen} onOpenChange={(open) => {
        setIsFormOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="operations-dialog max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingDocument ? 'Editar documento' : 'Subir documento'}</DialogTitle>
            <DialogDescription>
              {editingDocument ? 'Actualiza la clasificación y datos de consulta.' : 'Sube un archivo al bucket privado y registra su metadata.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!editingDocument && (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
                <Label htmlFor="document-file" className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Upload className="size-4" />
                  Archivo
                </Label>
                <Input
                  ref={fileInputRef}
                  id="document-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.xml"
                  onChange={handleFileChange}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Máximo 25 MB. Formatos: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, XML.
                </p>
                {selectedFile && (
                  <div className="mt-3 flex items-center gap-2 rounded-md bg-background px-3 py-2 text-sm">
                    <File className="size-4 text-primary" />
                    <span className="truncate">{selectedFile.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={form.description || ''}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tags">Etiquetas</Label>
                <Input
                  id="tags"
                  value={tagsText}
                  onChange={(event) => setTagsText(event.target.value)}
                  placeholder="mantención, póliza, cliente"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Entidad relacionada</Label>
                <Select
                  value={form.related_entity_type || 'none'}
                  onValueChange={(value) => setForm((current) => ({
                    ...current,
                    related_entity_type: value === 'none' ? null : value,
                    related_entity_id: value === 'none' ? null : current.related_entity_id,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin relación</SelectItem>
                    {RELATED_ENTITY_TYPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="related-entity-id">ID entidad relacionada</Label>
                <Input
                  id="related-entity-id"
                  value={form.related_entity_id || ''}
                  disabled={!form.related_entity_type}
                  onChange={(event) => setForm((current) => ({ ...current, related_entity_id: event.target.value }))}
                  placeholder="UUID opcional"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="document-date">Fecha documento</Label>
                <DatePickerButton
                  value={form.document_date}
                  onChange={(value) => setForm((current) => ({ ...current, document_date: value || null }))}
                  placeholder="Seleccionar fecha"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expires-at">Vencimiento</Label>
                <DatePickerButton
                  value={form.expires_at}
                  onChange={(value) => setForm((current) => ({ ...current, expires_at: value || null }))}
                  placeholder="Seleccionar fecha"
                />
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 md:col-span-2">
                <Checkbox
                  id="is-confidential"
                  checked={Boolean(form.is_confidential)}
                  disabled={!canManageConfidential}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, is_confidential: checked === true }))}
                />
                <div>
                  <Label htmlFor="is-confidential" className="font-medium">Documento confidencial</Label>
                  <p className="text-xs text-muted-foreground">
                    Solo administradores pueden crear o modificar documentos confidenciales.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={uploading || updating} className="gap-2">
                {(uploading || updating) ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
                {editingDocument ? 'Guardar cambios' : 'Subir documento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(documentToDelete)} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
        <DialogContent className="operations-dialog border-border/70 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="size-5 text-danger" />
              Eliminar documento
            </DialogTitle>
            <DialogDescription>
              Esta acción eliminará el archivo del Storage y borrará el registro de la base de datos.
            </DialogDescription>
          </DialogHeader>

          {documentToDelete && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg border border-border/70 bg-muted/40 p-2">
                    <FileText className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{documentToDelete.title}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {documentToDelete.file_name} — {categoryLabel(documentToDelete.category)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-warning">
                  <ShieldAlert className="size-4" />
                  <span className="text-sm font-medium">Confirmación requerida</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Ingresa tu contraseña de usuario para confirmar la eliminación definitiva.
                </p>

                <div className="space-y-2 border-t border-border/70 pt-2">
                  <Label htmlFor="delete-document-password" className="text-sm">
                    Ingrese su contraseña para confirmar
                  </Label>
                  <Input
                    id="delete-document-password"
                    type="password"
                    placeholder="Contraseña"
                    value={deletePassword}
                    onChange={(event) => {
                      setDeletePassword(event.target.value);
                      setDeletePasswordError('');
                    }}
                    onKeyDown={(event) => event.key === 'Enter' && handleDelete()}
                  />
                  {deletePasswordError && (
                    <p className="text-xs text-destructive">{deletePasswordError}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="border-border/70 bg-background/60"
              onClick={() => setDocumentToDelete(null)}
              disabled={verifyingDelete || deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={verifyingDelete || deleting || !deletePassword.trim()}
            >
              {verifyingDelete ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Verificando...
                </>
              ) : deleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 size-4" />
                  Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentLibrary;
