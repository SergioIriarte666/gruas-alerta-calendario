import { useState } from 'react';
import { Loader2, Upload, UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { createLogger } from '@/lib/logger';
import { parseSiiRcvCsv, type ParsedRcvRow } from '@/utils/siiRcvParser';
import { useSiiRcvImporter, useLowboyMissingNames, useLowboyRutBackfill } from '@/hooks/useSiiRcv';
import type { SiiBookType } from '@/types/siiRcv';

const logger = createLogger('SiiRcvImportCard');

const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

interface SiiRcvImportCardProps {
  entityRut: string;
  onEntityRutChange: (value: string) => void;
}

export function SiiRcvImportCard({ entityRut, onEntityRutChange }: SiiRcvImportCardProps) {
  const { mutateAsync: runImport, isPending, progress } = useSiiRcvImporter();
  const { data: missingRuts = [] } = useLowboyMissingNames(entityRut);
  const { mutate: runBackfill, isPending: isBackfilling } = useLowboyRutBackfill(entityRut);
  const [file, setFile] = useState<File | null>(null);
  const [bookType, setBookType] = useState<SiiBookType | null>(null);
  const [rows, setRows] = useState<ParsedRcvRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;

    setParsing(true);
    setRows([]);
    setParseErrors([]);
    try {
      const result = await parseSiiRcvCsv(selected);
      if (result.errors.length > 0) {
        setParseErrors(result.errors);
        setFile(null);
        setBookType(null);
        return;
      }
      setFile(selected);
      setBookType(result.bookType);
      setRows(result.rows);
      if (!result.bookType) {
        toast.info('No fue posible detectar automáticamente el tipo de libro. Selecciónelo manualmente.');
      }
    } catch (error) {
      logger.error('Error parseando CSV RCV', error);
      toast.error(error instanceof Error ? error.message : 'No fue posible leer el archivo CSV.');
    } finally {
      setParsing(false);
    }
  };

  const validRows = rows.filter((row) => !row._invalid);
  const invalidCount = rows.length - validRows.length;

  const handleImport = async () => {
    if (!file || !bookType || !entityRut.trim()) return;
    const period = validRows[0]?.doc_date ? validRows[0].doc_date.slice(0, 7) : null;
    try {
      await runImport({
        entityRut: entityRut.trim(),
        bookType,
        fileName: file.name,
        period,
        rows,
      });
      setFile(null);
      setRows([]);
      setBookType(null);
    } catch {
      // no-op: onError already handled it
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="text-base">Importar CSV del RCV</CardTitle>
        {missingRuts.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => runBackfill(missingRuts)}
            disabled={isBackfilling}
          >
            {isBackfilling ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserSearch className="mr-2 size-4" />}
            Completar razones sociales ({missingRuts.length})
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sii-entity-rut">RUT de la entidad</Label>
            <Input
              id="sii-entity-rut"
              value={entityRut}
              onChange={(event) => onEntityRutChange(event.target.value)}
              placeholder="78.387.656-6"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sii-csv-file">Archivo CSV</Label>
            <Input id="sii-csv-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} disabled={parsing || isPending} />
          </div>
        </div>

        {parseErrors.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {parseErrors.map((error) => <p key={error}>{error}</p>)}
          </div>
        )}

        {file && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de libro</Label>
              <RadioGroup
                value={bookType ?? undefined}
                onValueChange={(value) => setBookType(value as SiiBookType)}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="venta" id="sii-book-venta" />
                  <Label htmlFor="sii-book-venta" className="font-normal">Venta</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="compra" id="sii-book-compra" />
                  <Label htmlFor="sii-book-compra" className="font-normal">Compra</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="success">{validRows.length} filas válidas</Badge>
              {invalidCount > 0 && <Badge variant="destructive">{invalidCount} filas inválidas</Badge>}
            </div>

            {validRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <Table className="min-w-[50rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo Doc</TableHead>
                      <TableHead>Folio</TableHead>
                      <TableHead>Contraparte</TableHead>
                      <TableHead className="text-right">Neto</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validRows.slice(0, 10).map((row) => (
                      <TableRow key={`${row.doc_type}-${row.folio}-${row._rowIndex}`}>
                        <TableCell>{row.doc_date}</TableCell>
                        <TableCell>{row.doc_type}</TableCell>
                        <TableCell>{row.folio}</TableCell>
                        <TableCell className="max-w-56 truncate">{row.counterpart_name || row.counterpart_rut}</TableCell>
                        <TableCell className="text-right">{formatCLP(row.net_amount)}</TableCell>
                        <TableCell className="text-right">{formatCLP(row.total_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="border-t p-2 text-center text-xs text-muted-foreground">
                  Vista previa: primeras 10 de {validRows.length} filas.
                </p>
              </div>
            )}

            {isPending && (
              <div className="space-y-2">
                <Progress value={progress.total ? (progress.current / progress.total) * 100 : 0} />
                <p className="text-center text-xs text-muted-foreground">Importando {progress.current} de {progress.total}…</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleImport} disabled={!bookType || !entityRut.trim() || isPending || validRows.length === 0}>
                {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
                Importar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
