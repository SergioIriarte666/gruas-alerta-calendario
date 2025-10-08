
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				// TMS colors - Sistema unificado
				tms: {
					green: '84 100% 58%',        /* #9cfa24 */
					'green-light': '84 100% 65%',  /* #a1fb3d */
					'green-dark': '84 100% 45%',   /* #7ae01b */
					status: {
						pending: '45 93% 47%',     /* #f59e0b */
						closed: '217 91% 60%',     /* #3b82f6 */
						invoiced: '142 76% 36%',   /* #10b981 */
						overdue: '0 84% 60%'       /* #ef4444 */
					}
				},
				// Sidebar colors - Colores para grupos de navegación
				sidebar: {
					principal: '84 100% 58%',      /* Verde lima - Principal */
					operaciones: '217 91% 60%',    /* Azul - Operaciones */
					recursos: '25 95% 53%',        /* Naranja - Recursos */
					inventario: '271 81% 56%',     /* Púrpura - Inventario */
					finanzas: '142 76% 36%',       /* Verde esmeralda - Finanzas */
					analisis: '330 81% 60%',       /* Rosa - Análisis */
					configuracion: '215 16% 47%'   /* Gris - Configuración */
				},
				// Color palette - HSL format
				slate: {
					50: '210 40% 98%',   /* #f8fafc */
					100: '210 40% 96%',  /* #f1f5f9 */
					200: '214 32% 91%',  /* #e2e8f0 */
					300: '213 27% 84%',  /* #cbd5e1 */
					400: '215 20% 65%',  /* #94a3b8 */
					500: '215 16% 47%',  /* #64748b */
					600: '215 19% 35%',  /* #475569 */
					700: '215 25% 27%',  /* #334155 */
					800: '217 33% 17%',  /* #1e293b */
					900: '222 84% 5%',   /* #0f172a */
					950: '229 84% 2%'    /* #020617 */
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-secondary': 'var(--gradient-secondary)', 
				'gradient-card': 'var(--gradient-card)',
				'gradient-hero': 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 100%)',
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'pulse-glow': {
					'0%, 100%': {
						boxShadow: '0 0 5px rgba(156, 250, 36, 0.5)'
					},
					'50%': {
						boxShadow: '0 0 20px rgba(156, 250, 36, 0.8)'
					}
				},
				'shimmer': {
					'0%': {
						backgroundPosition: '-200% 0'
					},
					'100%': {
						backgroundPosition: '200% 0'
					}
				},
				'progress-flow': {
					'0%': {
						backgroundPosition: '0% 50%'
					},
					'50%': {
						backgroundPosition: '100% 50%'
					},
					'100%': {
						backgroundPosition: '0% 50%'
					}
				},
				'bounce-in': {
					'0%': {
						transform: 'scale(0.3)',
						opacity: '0'
					},
					'50%': {
						transform: 'scale(1.05)',
						opacity: '1'
					},
					'70%': {
						transform: 'scale(0.95)'
					},
					'100%': {
						transform: 'scale(1)'
					}
				},
				'slide-up': {
					'0%': {
						transform: 'translateY(20px)',
						opacity: '0'
					},
					'100%': {
						transform: 'translateY(0)',
						opacity: '1'
					}
				},
				'scale-pulse': {
					'0%, 100%': {
						transform: 'scale(1)'
					},
					'50%': {
						transform: 'scale(1.05)'
					}
				},
				'rotate-slow': {
					'0%': {
						transform: 'rotate(0deg)'
					},
					'100%': {
						transform: 'rotate(360deg)'
					}
				},
				'breathe': {
					'0%, 100%': {
						transform: 'scale(1)',
						opacity: '0.5'
					},
					'50%': {
						transform: 'scale(1.03)',
						opacity: '0.8'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
				'shimmer': 'shimmer 2s linear infinite',
				'progress-flow': 'progress-flow 3s ease infinite',
				'bounce-in': 'bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
				'slide-up': 'slide-up 0.5s ease-out',
				'scale-pulse': 'scale-pulse 2s ease-in-out infinite',
				'rotate-slow': 'rotate-slow 3s linear infinite',
				'breathe': 'breathe 3s ease-in-out infinite'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
