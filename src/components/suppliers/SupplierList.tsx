import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  Eye,
  Search,
  Calendar,
  User,
  Loader2
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface SupplierDocument {
  id: string;
  supplier_id: string;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  description?: string;
  category: 'contract' | 'invoice' | 'certificate' | 'tax_document' | 'other';
}

interface SupplierDocumentListProps {
  supplierId: string;
  supplierName: string;
}

export const SupplierDocumentList: React.FC<SupplierDocumentListProps> = ({ 
  supplierId, 
  supplierName 
}) => {
  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = [
    { value: 'contract', label: 'Contratos' },
    { value: 'invoice', label: 'Facturas' },
    { value: 'certificate', label: 'Certificados' },
    { value: 'tax_document', label: 'Documentos Tributarios' },
    { value: 'other', label: 'Otros' }
  ];

  const getCategoryLabel = (category: string) => {
    return categories.find(cat => cat.value === category)?.label || 'Otros';
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      contract: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      invoice: 'bg-green-500/20 text-green-400 border-green-500/30',
      certificate: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      tax_document: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      other: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      // Aquí iría la lógica de subida de archivos a Supabase Storage
      // Por ahora simularemos la subida
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simular documento subido
      const newDoc: SupplierDocument = {
        id: Date.now().toString(),
        supplier_id: supplierId,
        name: files[0].name,
        file_url: '#',
        file_type: files[0].type,
        file_size: files[0].size,
        uploaded_by: 'Usuario Actual',
        uploaded_at: new Date().toISOString(),
        category: 'other'
      };
      
      setDocuments(prev => [newDoc, ...prev]);
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = (document: SupplierDocument) => {
    // Aquí iría la lógica de descarga
    console.log('Downloading:', document.name);
  };

  const handleDelete = (documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  const handleView = (document: SupplierDocument) => {
    // Aquí iría la lógica para abrir el documento en una nueva ventana
    window.open(document.file_url, '_blank');
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (doc.description && doc.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Documentos de {supplierName}</h2>
          <p className="text-gray-400">Gestiona los documentos y archivos del proveedor</p>
        </div>

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isUploading ? 'Subiendo...' : 'Subir Documento'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-300">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar documentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300">Categoría</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">
            Documentos ({filteredDocuments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                No se encontraron documentos
              </h3>
              <p className="text-gray-400">
                {searchTerm || selectedCategory !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Comienza subiendo el primer documento'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Documento</TableHead>
                    <TableHead className="text-gray-300">Categoría</TableHead>
                    <TableHead className="text-gray-300">Tamaño</TableHead>
                    <TableHead className="text-gray-300">Subido</TableHead>
                    <TableHead className="text-gray-300">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((document) => (
                    <TableRow key={document.id} className="border-gray-700">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <FileText className="h-8 w-8 text-blue-400" />
                          <div>
                            <div className="font-medium text-white">{document.name}</div>
                            {document.description && (
                              <div className="text-sm text-gray-400">{document.description}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge className={getCategoryColor(document.category)}>
                          {getCategoryLabel(document.category)}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <span className="text-gray-300">
                          {formatFileSize(document.file_size)}
                        </span>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm text-gray-300">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(document.uploaded_at)}
                          </div>
                          <div className="flex items-center text-sm text-gray-400">
                            <User className="h-3 w-3 mr-1" />
                            {document.uploaded_by}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(document)}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(document)}
                            className="text-green-400 hover:text-green-300 hover:bg-green-400/10"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-gray-800 border-gray-700">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">
                                  Eliminar Documento
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-300">
                                  ¿Estás seguro de que deseas eliminar "{document.name}"? 
                                  Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(document.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};