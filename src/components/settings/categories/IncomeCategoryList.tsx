import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const IncomeCategoryList = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Categorías de Ingresos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          La gestión de categorías de ingresos estará disponible próximamente.
        </div>
      </CardContent>
    </Card>
  );
};
