import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { XMLSupplierParser } from '@/utils/xmlParser/xmlSupplierParser';
import { XMLCompleteParseResult } from '@/types/suppliers';
import { dedupeSuppliersByIdentity } from '@/utils/supplierIdentity';
import { toast } from 'sonner';

interface UseXMLParsingOptions {
  onFileSelected?: (file: File) => void;
  onParsed?: (result: XMLCompleteParseResult) => void;
}

export function useXMLParsing({ onFileSelected, onParsed }: UseXMLParsingOptions = {}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<XMLCompleteParseResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Stable refs so callbacks never stale-close over old values
  const onFileSelectedRef = useRef(onFileSelected);
  onFileSelectedRef.current = onFileSelected;
  const onParsedRef = useRef(onParsed);
  onParsedRef.current = onParsed;

  const handleAnalyzeFile = useCallback(async (fileParam?: File) => {
    const fileToAnalyze = fileParam ?? selectedFile;
    if (!fileToAnalyze) return;

    setIsAnalyzing(true);
    try {
      const parser = new XMLSupplierParser();
      const result = await parser.parseXMLCompleteFile(fileToAnalyze);
      const uniqueSuppliers = dedupeSuppliersByIdentity(result.suppliers);
      const normalizedResult: XMLCompleteParseResult = {
        ...result,
        suppliers: uniqueSuppliers,
        totalSuppliers: uniqueSuppliers.length,
        validSuppliers: uniqueSuppliers.filter(s => s.name && s.name.trim().length > 0).length,
      };
      setParseResult(normalizedResult);
      onParsedRef.current?.(normalizedResult);
    } catch (_error) {
      toast.error('Error al analizar el archivo XML');
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedFile]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type === 'text/xml' || file.type === 'application/xml' || file.name.endsWith('.xml')) {
      setSelectedFile(file);
      setParseResult(null);
      onFileSelectedRef.current?.(file);
      handleAnalyzeFile(file);
    } else {
      toast.error('Por favor selecciona un archivo XML válido');
    }
  }, [handleAnalyzeFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/xml': ['.xml'], 'application/xml': ['.xml'] },
    multiple: false,
  });

  const reset = useCallback(() => {
    setSelectedFile(null);
    setParseResult(null);
  }, []);

  return {
    selectedFile,
    parseResult,
    isAnalyzing,
    getRootProps,
    getInputProps,
    isDragActive,
    handleAnalyzeFile,
    reset,
  };
}
