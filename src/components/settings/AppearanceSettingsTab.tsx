import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { useAppearance } from '@/contexts/AppearanceContext';
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext';
import type { InterfaceDensity, InterfaceTextScale } from '@/types/settings';
import { cn } from '@/lib/utils';
import {
  AlignJustify,
  Check,
  Cloud,
  CloudOff,
  Gauge,
  Loader2,
  Monitor,
  Moon,
  PanelLeftClose,
  Palette,
  RotateCcw,
  Sparkles,
  Sun,
  Text,
} from 'lucide-react';

const surfaceClassName = 'border-border/70 bg-card/80 shadow-sm';

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  { value: 'light', label: 'Claro', description: 'Máxima luminosidad', icon: Sun },
  { value: 'dark', label: 'Oscuro', description: 'Menor brillo ambiental', icon: Moon },
  { value: 'system', label: 'Automático', description: 'Sigue este equipo', icon: Monitor },
];

const densityOptions: Array<{
  value: InterfaceDensity;
  label: string;
  description: string;
}> = [
  { value: 'comfortable', label: 'Cómoda', description: 'Más aire entre controles' },
  { value: 'compact', label: 'Compacta', description: 'Más información visible' },
];

const scaleOptions: Array<{
  value: InterfaceTextScale;
  label: string;
  description: string;
}> = [
  { value: 100, label: 'Normal', description: '100%' },
  { value: 110, label: 'Grande', description: '110%' },
  { value: 120, label: 'Muy grande', description: '120%' },
];

const ChoiceButton = ({
  selected,
  onClick,
  icon: Icon,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: typeof Sun;
  label: string;
  description: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={cn(
      'group relative min-h-24 rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      selected
        ? 'border-primary/50 bg-primary/10 shadow-sm ring-1 ring-primary/15'
        : 'border-border/70 bg-background/55 hover:border-primary/30 hover:bg-accent/50',
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div className={cn(
        'flex size-9 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground',
        selected && 'border-primary/20 bg-primary text-primary-foreground',
      )}>
        {Icon ? <Icon className="size-4" /> : <span className="text-sm font-bold">Aa</span>}
      </div>
      <span className={cn(
        'flex size-5 items-center justify-center rounded-full border border-border/70 text-transparent',
        selected && 'border-primary bg-primary text-primary-foreground',
      )}>
        <Check className="size-3" strokeWidth={3} />
      </span>
    </div>
    <span className="mt-3 block text-sm font-semibold text-foreground">{label}</span>
    <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
  </button>
);

const SyncBadge = ({ status }: { status: ReturnType<typeof useAppearance>['syncStatus'] }) => {
  if (status === 'loading' || status === 'saving') {
    return (
      <Badge variant="outline" className="gap-1.5 rounded-full bg-background/70 px-3 py-1">
        <Loader2 className="size-3 animate-spin" />
        {status === 'loading' ? 'Cargando' : 'Guardando'}
      </Badge>
    );
  }

  if (status === 'saved') {
    return (
      <Badge variant="success" className="gap-1.5 rounded-full px-3 py-1">
        <Cloud className="size-3" />
        Sincronizado
      </Badge>
    );
  }

  return (
    <Badge variant="warning" className="gap-1.5 rounded-full px-3 py-1">
      <CloudOff className="size-3" />
      Solo este equipo
    </Badge>
  );
};

export const AppearanceSettingsTab = () => {
  const { preferences, syncStatus, syncError, updatePreferences, resetPreferences } = useAppearance();
  const { resolvedTheme } = useTheme();

  return (
    <div className="space-y-6">
      <Card className={surfaceClassName}>
        <CardHeader className="border-b p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg text-foreground sm:text-xl">
                <Palette className="size-5 text-primary" />
                Apariencia personal
              </CardTitle>
              <CardDescription className="mt-1.5 max-w-2xl">
                Ajusta la lectura y la densidad de trabajo. Los cambios se aplican al instante y se guardan automáticamente.
              </CardDescription>
            </div>
            <SyncBadge status={syncStatus} />
          </div>
          {syncError && (
            <p className="mt-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-foreground">
              {syncError}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-8 p-4 sm:p-6">
          <section className="space-y-3" aria-labelledby="appearance-theme-label">
            <div>
              <Label id="appearance-theme-label" className="flex items-center gap-2 text-sm font-semibold">
                <Sun className="size-4 text-primary" />
                Tema
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">Define la luminosidad general de la plataforma.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {themeOptions.map((option) => (
                <ChoiceButton
                  key={option.value}
                  selected={preferences.theme === option.value}
                  onClick={() => updatePreferences({ theme: option.value })}
                  icon={option.icon}
                  label={option.label}
                  description={option.description}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="appearance-density-label">
            <div>
              <Label id="appearance-density-label" className="flex items-center gap-2 text-sm font-semibold">
                <AlignJustify className="size-4 text-primary" />
                Densidad de interfaz
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">Cambia el espacio disponible sin ocultar información.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {densityOptions.map((option) => (
                <ChoiceButton
                  key={option.value}
                  selected={preferences.density === option.value}
                  onClick={() => updatePreferences({ density: option.value })}
                  icon={option.value === 'compact' ? Gauge : Sparkles}
                  label={option.label}
                  description={option.description}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="appearance-scale-label">
            <div>
              <Label id="appearance-scale-label" className="flex items-center gap-2 text-sm font-semibold">
                <Text className="size-4 text-primary" />
                Tamaño de lectura
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">Amplía textos y controles de manera proporcional.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {scaleOptions.map((option) => (
                <ChoiceButton
                  key={option.value}
                  selected={preferences.textScale === option.value}
                  onClick={() => updatePreferences({ textScale: option.value })}
                  label={option.label}
                  description={option.description}
                />
              ))}
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background/55 p-4">
              <div className="min-w-0">
                <Label htmlFor="appearance-reduce-motion" className="flex items-center gap-2 font-semibold">
                  <Sparkles className="size-4 text-primary" />
                  Reducir movimiento
                </Label>
                <p className="mt-1 text-sm text-muted-foreground">Minimiza transiciones y animaciones decorativas.</p>
              </div>
              <Switch
                id="appearance-reduce-motion"
                checked={preferences.reduceMotion}
                onCheckedChange={(reduceMotion) => updatePreferences({ reduceMotion })}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background/55 p-4">
              <div className="min-w-0">
                <Label htmlFor="appearance-sidebar-collapsed" className="flex items-center gap-2 font-semibold">
                  <PanelLeftClose className="size-4 text-primary" />
                  Menú lateral compacto
                </Label>
                <p className="mt-1 text-sm text-muted-foreground">Recuerda el menú contraído en pantallas grandes.</p>
              </div>
              <Switch
                id="appearance-sidebar-collapsed"
                checked={preferences.sidebarCollapsed}
                onCheckedChange={(sidebarCollapsed) => updatePreferences({ sidebarCollapsed })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
        <CardHeader className="border-b bg-muted/30 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Vista aplicada</CardTitle>
              <CardDescription>Representación compacta de la configuración actual.</CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full bg-background/70">
              {resolvedTheme === 'dark' ? 'Oscuro' : 'Claro'} · {preferences.density === 'compact' ? 'Compacta' : 'Cómoda'} · {preferences.textScale}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {/* El espaciado sale de `--app-density` (index.css), el mismo token que
              usa el shell real: la vista previa no puede divergir de la app. */}
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-background shadow-inner">
            <div className={cn(
              'grid min-h-56 grid-cols-[3.25rem_1fr]',
              !preferences.sidebarCollapsed && 'sm:grid-cols-[9rem_1fr]',
            )}>
              <div className="border-r border-border/70 bg-card/90 p-2.5">
                <div className="mb-4 flex items-center gap-2 border-b border-border/60 pb-3">
                  <div className="size-7 shrink-0 rounded-lg bg-primary" />
                  <span className={cn(
                    'hidden truncate text-xs font-bold uppercase tracking-widest text-muted-foreground',
                    !preferences.sidebarCollapsed && 'sm:block',
                  )}>
                    Operaciones
                  </span>
                </div>
                <div className="space-y-1.5">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className={cn(
                      'appearance-preview-nav-item flex items-center gap-2 rounded-lg px-2',
                      item === 0 ? 'bg-primary/[0.12] text-primary' : 'text-muted-foreground',
                    )}>
                      <span className="size-3 shrink-0 rounded-sm border border-current" />
                      <span className={cn(
                        'hidden h-1.5 flex-1 rounded-full bg-current opacity-40',
                        !preferences.sidebarCollapsed && 'sm:block',
                      )} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="appearance-preview-body min-w-0">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="h-2.5 w-28 rounded-full bg-foreground/80" />
                    <div className="mt-2 h-1.5 w-40 max-w-full rounded-full bg-muted-foreground/30" />
                  </div>
                  <div className="h-7 w-20 rounded-lg bg-primary" />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[['12', 'Servicios'], ['04', 'Pendientes'], ['96%', 'Cumplimiento']].map(([value, label]) => (
                    <div key={label} className="appearance-preview-metric rounded-xl border border-border/70 bg-card">
                      <p className="text-base font-bold text-foreground">{value}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 overflow-hidden rounded-xl border border-border/70">
                  {[0, 1, 2].map((row) => (
                    <div
                      key={row}
                      className="appearance-preview-row grid grid-cols-[1fr_4rem] items-center border-b border-border/60 px-3 last:border-0"
                    >
                      <span className="h-1.5 w-3/5 rounded-full bg-muted-foreground/25" />
                      <span className={cn('ml-auto h-4 w-12 rounded-full', row === 0 ? 'bg-primary/20' : 'bg-muted')} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Datos de ejemplo — solo ilustran el estilo aplicado, no son métricas del sistema.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Volver a la apariencia inicial</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Tema automático, densidad cómoda y texto al 100%.</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="border-border/70 bg-background">
              <RotateCcw className="size-4" />
              Restablecer apariencia
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Restablecer la apariencia?</AlertDialogTitle>
              <AlertDialogDescription>
                Solo se modificarán tus preferencias visuales. Los datos y la configuración operativa no cambiarán.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={resetPreferences}>Restablecer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
