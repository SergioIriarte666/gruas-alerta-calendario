
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import plugin from "tailwindcss/plugin";

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
			fontFamily: {
				sans: ['Montserrat', 'system-ui', 'sans-serif'],
			},
			boxShadow: {
				nav: 'var(--shadow-nav)',
				'glow-primary': '0 0 24px hsl(var(--primary) / 0.35)',
				'glow-info': '0 0 24px hsl(var(--info) / 0.35)',
				'glow-success': '0 0 24px hsl(var(--success) / 0.35)',
				'glow-warning': '0 0 24px hsl(var(--warning) / 0.35)',
				'glow-danger': '0 0 24px hsl(var(--danger) / 0.35)',
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				overlay: 'hsl(var(--overlay))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					soft: 'hsl(var(--primary-soft))'
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
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))',
					text: 'hsl(var(--success-text))',
					soft: 'hsl(var(--success-soft))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))',
					text: 'hsl(var(--warning-text))',
					soft: 'hsl(var(--warning-soft))'
				},
				danger: {
					DEFAULT: 'hsl(var(--danger))',
					foreground: 'hsl(var(--danger-foreground))',
					text: 'hsl(var(--danger-text))',
					soft: 'hsl(var(--danger-soft))'
				},
				info: {
					DEFAULT: 'hsl(var(--info))',
					foreground: 'hsl(var(--info-foreground))',
					text: 'hsl(var(--info-text))',
					soft: 'hsl(var(--info-soft))'
				},
				auth: {
					background: 'hsl(var(--auth-background))',
					foreground: 'hsl(var(--auth-foreground))',
					muted: 'hsl(var(--auth-muted))',
					surface: 'hsl(var(--auth-surface))',
					border: 'hsl(var(--auth-border))',
					success: 'hsl(var(--auth-success))',
					warning: 'hsl(var(--auth-warning))',
					danger: 'hsl(var(--auth-danger))',
					input: 'hsl(var(--auth-input))',
					'input-foreground': 'hsl(var(--auth-input-foreground))',
					'input-muted': 'hsl(var(--auth-input-muted))',
					'input-border': 'hsl(var(--auth-input-border))'
				},
				signature: {
					surface: 'hsl(var(--signature-surface))',
					ink: 'hsl(var(--signature-ink))'
				},
				effect: {
					highlight: 'hsl(var(--effect-highlight))'
				},
				// Primitiva sidebar: los roles reutilizan los tokens globales.
				sidebar: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--foreground))',
					primary: 'hsl(var(--primary))',
					'primary-foreground': 'hsl(var(--primary-foreground))',
					accent: 'hsl(var(--accent))',
					'accent-foreground': 'hsl(var(--accent-foreground))',
					border: 'hsl(var(--border))',
					ring: 'hsl(var(--ring))'
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
				'gradient-portal': 'var(--gradient-portal)',
				'auth-glow': 'var(--auth-glow)',
				'auth-vignette': 'var(--auth-vignette)',
				'gradient-hero': 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-hover)) 100%)',
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
						boxShadow: '0 0 5px hsl(var(--primary) / 0.35)'
					},
					'50%': {
						boxShadow: '0 0 20px hsl(var(--primary) / 0.6)'
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
	plugins: [
		tailwindcssAnimate,
		plugin(function({ addUtilities }) {
			addUtilities({
				'.scrollbar-none': {
					'-ms-overflow-style': 'none',
					'scrollbar-width': 'none',
					'&::-webkit-scrollbar': { display: 'none' },
				},
			});
		}),
	],
} satisfies Config;
