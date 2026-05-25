
import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';

const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();

  // Don't render if not installable or already installed
  if (!isInstallable || isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    await promptInstall();
  };

  return (
    <Button
      onClick={handleInstallClick}
      variant="outline"
      size="sm"
      className="border-tms-green text-tms-green hover:bg-tms-green hover:text-black"
      title="Instalar aplicación"
    >
      <Download className="size-4 mr-2" />
      <span className="hidden sm:inline">Instalar App</span>
    </Button>
  );
};

export default PWAInstallButton;
