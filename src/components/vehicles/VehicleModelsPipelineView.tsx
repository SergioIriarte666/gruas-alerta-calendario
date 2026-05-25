import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface VehicleModel {
  id: string;
  name: string;
  brand_id: string;
  created_at: string;
  vehicle_brands?: {
    name: string;
  };
}

interface VehicleModelGroup {
  brand: {
    id: string;
    name: string;
  };
  models: VehicleModel[];
  totalModels: number;
}

interface VehicleModelsPipelineViewProps {
  models: VehicleModel[];
  searchTerm: string;
  onEdit: (model: VehicleModel) => void;
  onDelete: (modelId: string) => void;
  isDeleting: boolean;
}

export const VehicleModelsPipelineView: React.FC<VehicleModelsPipelineViewProps> = ({
  models,
  searchTerm,
  onEdit,
  onDelete,
  isDeleting,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const groupedModels = useMemo(() => {
    // Filter models based on search term
    let filtered = models;
    if (searchTerm.trim()) {
      filtered = models.filter(model =>
        model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.vehicle_brands?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Group models by brand
    const groups: Map<string, VehicleModelGroup> = new Map();
    
    filtered.forEach(model => {
      const brandId = model.brand_id || 'unknown';
      const brandName = model.vehicle_brands?.name || 'Sin Marca';
      
      if (!groups.has(brandId)) {
        groups.set(brandId, {
          brand: { id: brandId, name: brandName },
          models: [],
          totalModels: 0,
        });
      }
      
      const group = groups.get(brandId)!;
      group.models.push(model);
      group.totalModels++;
    });

    // Sort groups by brand name and models within each group
    return Array.from(groups.values())
      .sort((a, b) => a.brand.name.localeCompare(b.brand.name))
      .map(group => ({
        ...group,
        models: group.models.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [models, searchTerm]);

  // Auto-expand groups with search results
  useMemo(() => {
    if (searchTerm.trim()) {
      const newExpanded = new Set<string>();
      groupedModels.forEach(group => {
        newExpanded.add(group.brand.id);
      });
      setExpandedGroups(newExpanded);
    }
  }, [searchTerm, groupedModels]);

  const toggleGroup = (brandId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(brandId)) {
        newSet.delete(brandId);
      } else {
        newSet.add(brandId);
      }
      return newSet;
    });
  };

  if (groupedModels.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">
            {searchTerm.trim() ? 'No se encontraron resultados para tu búsqueda' : 'No hay modelos registrados'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {groupedModels.map(group => {
        const isExpanded = expandedGroups.has(group.brand.id);
        
        return (
          <Card key={group.brand.id} className="bg-card border-border">
            <Collapsible
              open={isExpanded}
              onOpenChange={() => toggleGroup(group.brand.id)}
            >
              <CollapsibleTrigger className="w-full">
                <CardContent className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="size-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-5 text-muted-foreground" />
                      )}
                      <h3 className="text-lg font-semibold">{group.brand.name}</h3>
                      <Badge variant="secondary" className="ml-2">
                        {group.totalModels} {group.totalModels === 1 ? 'modelo' : 'modelos'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="space-y-2 ml-8">
                    {group.models.map(model => (
                      <div
                        key={model.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{model.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Creado el {new Date(model.created_at).toLocaleDateString('es-CL')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(model);
                            }}
                          >
                            <Edit className="size-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar modelo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción eliminará el modelo "{model.name}" de la marca "{group.brand.name}" del sistema.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDelete(model.id)}
                                  disabled={isDeleting}
                                >
                                  {isDeleting ? 'Eliminando...' : 'Eliminar'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
};
