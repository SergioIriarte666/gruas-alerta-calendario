
import { useState, useEffect } from 'react';
import { BeforeInstallPromptEvent } from '@/types/pwa';
import { createLogger } from "@/lib/logger";


const logger = createLogger("usePWAInstall");
interface UsePWAInstallReturn {
  isInstallable: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<void>;
}

export const usePWAInstall = (): UsePWAInstallReturn => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      logger.debug('PWA: beforeinstallprompt event captured');
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      logger.debug('PWA: App installed successfully');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<void> => {
    if (!deferredPrompt) {
      logger.debug('PWA: No deferred prompt available');
      return;
    }

    try {
      logger.debug('PWA: Showing install prompt');
      await deferredPrompt.prompt();
      
      const choiceResult = await deferredPrompt.userChoice;
      logger.debug('PWA: User choice:', choiceResult.outcome);
      
      if (choiceResult.outcome === 'accepted') {
        logger.debug('PWA: User accepted installation');
      } else {
        logger.debug('PWA: User dismissed installation');
      }
      
      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      logger.error('PWA: Error showing install prompt:', error);
    }
  };

  return {
    isInstallable,
    isInstalled,
    promptInstall
  };
};
