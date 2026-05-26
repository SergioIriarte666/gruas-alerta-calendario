import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CalendarIcon, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/custom-toast';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, expiryDate?: string) => void;
  documentType: string;
  documentName: string;
  uploading: boolean;
}

export const DocumentUploadModal = ({
  isOpen,
  onClose,
  onUpload,
  documentType: _documentType,
  documentName,
  uploading
}: DocumentUploadModalProps) => {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date>();
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (file: File) => {
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        type: 'error',
        title: 'Formato no permitido',
        description: 'Solo se permiten archivos PDF, JPG y PNG',
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        type: 'error',
        title: 'Archivo demasiado grande',
        description: 'El archivo no puede ser mayor a 10MB',
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;

    const expiryDateString = expiryDate ? format(expiryDate, 'yyyy-MM-dd') : undefined;
    onUpload(selectedFile, expiryDateString);
    
    // Reset form
    setSelectedFile(null);
    setExpiryDate(undefined);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setExpiryDate(undefined);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="cranes-modal cranes-modal--upload border-border/70 bg-card sm:max-w-md">
        <DialogHeader className="cranes-modal__header">
          <DialogTitle>Actualizar {documentName}</DialogTitle>
          <DialogDescription>
            Selecciona un nuevo archivo para actualizar el documento y opcionalmente establece una nueva fecha de vencimiento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Area */}
          <div className="space-y-2">
            <Label>Seleccionar archivo</Label>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                dragOver ? "border-primary bg-primary/10" : "border-muted-foreground/25",
                "hover:border-primary hover:bg-primary/5"
              )}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <Upload className="size-5 text-primary" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="size-8 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-sm">Arrastra el archivo aquí o</p>
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => document.getElementById('file-input')?.click()}
                    >
                      selecciona desde tu computador
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PDF, JPG, PNG (máx. 10MB)
                  </p>
                </div>
              )}
            </div>
            <Input
              id="file-input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <Label>Fecha de vencimiento (opcional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expiryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {expiryDate ? format(expiryDate, "dd/MM/yyyy") : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiryDate}
                  onSelect={setExpiryDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Actions */}
        <div className="cranes-modal__footer flex justify-end gap-2 border-t border-border/70 pt-4">
          <Button variant="outline" className="border-border/70 bg-background/60" onClick={handleClose} disabled={uploading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || uploading}
          >
            {uploading ? 'Subiendo...' : 'Subir Documento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
