import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cl.gruas5norte.tmsoperador',
  appName: 'TMS Operador',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,
      appReadyTimeout: 15000,
    },
    SplashScreen: {
      // Quien cierra el splash es la app (SplashScreen.hide() en src/main.tsx,
      // apenas hay algo pintado). launchAutoHide queda encendido como red de
      // seguridad por si el arranque muere antes de llegar a esa llamada, y
      // launchShowDuration baja a 2 s para que esa red no sea la vía normal:
      // esperar el timeout es lo que dejaba a Capacitor evaluando JS en un
      // WebView sin contexto listo.
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
