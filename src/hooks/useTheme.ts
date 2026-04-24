
/**
 * Compat shim — el hook real vive ahora en `@/contexts/ThemeContext`.
 * Re-export para no romper imports existentes.
 */
export { useTheme } from "@/contexts/ThemeContext";
export type { ThemeMode, ResolvedTheme } from "@/contexts/ThemeContext";
