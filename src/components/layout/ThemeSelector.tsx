import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext';

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  { value: 'light', label: 'Claro', description: 'Superficies luminosas', icon: Sun },
  { value: 'dark', label: 'Oscuro', description: 'Menos brillo ambiental', icon: Moon },
  { value: 'system', label: 'Sistema', description: 'Usar preferencia del equipo', icon: Monitor },
];

export const ThemeSelector = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const ActiveIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full border border-border/70 bg-card text-foreground shadow-sm hover:bg-accent"
          aria-label={`Tema actual: ${theme === 'system' ? 'sistema' : resolvedTheme}. Cambiar apariencia`}
          title="Cambiar apariencia"
        >
          <ActiveIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 rounded-xl border-border/70 bg-popover/95 p-2 shadow-xl backdrop-blur-xl"
      >
        <DropdownMenuLabel className="px-2 py-2">
          <span className="block text-sm font-semibold text-foreground">Apariencia</span>
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            Elige cómo quieres ver la plataforma.
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemeMode)}>
          {themeOptions.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="rounded-lg py-2.5 pl-9 pr-2 focus:bg-accent"
              >
                <Icon className="size-4 text-muted-foreground" />
                <span>
                  <span className="block text-sm font-medium text-foreground">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.description}</span>
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
