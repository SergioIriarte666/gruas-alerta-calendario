import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('LiveUpdate');

const OTA_TOAST_ID = 'live-update-ready';

type LiveUpdatePlatform = 'android' | 'ios';

type BundleVersionRow = {
  id: string;
  version: string;
  bundle_url: string;
  checksum: string | null;
  min_native_version: string;
  platform: 'all' | LiveUpdatePlatform;
  is_active: boolean;
  notes: string | null;
  created_at: string | null;
};

let startupPromise: Promise<void> | null = null;
let updateCheckPromise: Promise<void> | null = null;

const tokenizeVersion = (value: string): Array<number | string> =>
  value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()));

export const compareLooseVersions = (left: string, right: string): number => {
  const a = tokenizeVersion(left);
  const b = tokenizeVersion(right);
  const maxLength = Math.max(a.length, b.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = a[index];
    const rightPart = b[index];

    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;

    if (typeof leftPart === 'number' && typeof rightPart === 'number') {
      return leftPart > rightPart ? 1 : -1;
    }

    return String(leftPart).localeCompare(String(rightPart), undefined, { numeric: true });
  }

  return 0;
};

const getNativePlatform = (): LiveUpdatePlatform | null => {
  const platform = Capacitor.getPlatform();
  if (platform === 'android' || platform === 'ios') return platform;
  return null;
};

const getTargetBundleVersion = async (platform: LiveUpdatePlatform): Promise<BundleVersionRow | null> => {
  const { data, error } = await supabase
    .from('app_bundle_versions')
    .select('id, version, bundle_url, checksum, min_native_version, platform, is_active, notes, created_at')
    .eq('is_active', true)
    .in('platform', [platform, 'all']);

  if (error) {
    throw new Error(error.message || 'No se pudo consultar la versión OTA activa');
  }

  if (!data?.length) {
    return null;
  }

  const exactPlatform = data.find((row) => row.platform === platform);
  return (exactPlatform ?? data[0]) as BundleVersionRow;
};

const findDownloadedBundleId = async (version: string) => {
  const installedBundles = await CapacitorUpdater.list();
  const match = installedBundles.bundles.find((bundle) => bundle.version === version);
  return match?.id ?? null;
};

const isBundleNewer = async (targetVersion: string) => {
  const current = await CapacitorUpdater.current();
  const currentVersion = current.bundle.version;

  if (!currentVersion) {
    return true;
  }

  return compareLooseVersions(targetVersion, currentVersion) > 0;
};

const isNativeVersionCompatible = async (minNativeVersion: string) => {
  const appInfo = await CapacitorApp.getInfo();
  return compareLooseVersions(appInfo.version, minNativeVersion) >= 0;
};

const notifyCurrentBundleReady = async () => {
  const result = await CapacitorUpdater.notifyAppReady();
  logger.info('Current bundle marked as ready', {
    bundleId: result.bundle.id,
    bundleVersion: result.bundle.version,
  });
};

export const checkForLiveUpdate = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  if (updateCheckPromise) {
    return updateCheckPromise;
  }

  updateCheckPromise = (async () => {
    const platform = getNativePlatform();
    if (!platform) {
      return;
    }

    try {
      const activeBundle = await getTargetBundleVersion(platform);
      if (!activeBundle) {
        logger.debug('No active OTA bundle found for platform', { platform });
        return;
      }

      const nativeCompatible = await isNativeVersionCompatible(activeBundle.min_native_version);
      if (!nativeCompatible) {
        const appInfo = await CapacitorApp.getInfo();
        logger.info('Skipping OTA bundle because native app version is too old', {
          bundleVersion: activeBundle.version,
          installedNativeVersion: appInfo.version,
          minNativeVersion: activeBundle.min_native_version,
        });
        return;
      }

      const newerBundleAvailable = await isBundleNewer(activeBundle.version);
      if (!newerBundleAvailable) {
        logger.debug('Current bundle is already up to date', {
          targetVersion: activeBundle.version,
        });
        return;
      }

      const existingBundleId = await findDownloadedBundleId(activeBundle.version);
      const downloadedBundle = existingBundleId
        ? { id: existingBundleId, version: activeBundle.version }
        : await CapacitorUpdater.download({
            url: activeBundle.bundle_url,
            version: activeBundle.version,
            checksum: activeBundle.checksum ?? undefined,
          });

      await CapacitorUpdater.next({ id: downloadedBundle.id });
      await CapacitorUpdater.setMultiDelay({
        delayConditions: [{ kind: 'kill' }],
      });

      logger.info('OTA bundle downloaded and scheduled for next cold start', {
        bundleId: downloadedBundle.id,
        bundleVersion: downloadedBundle.version,
        platform,
      });

      if (!existingBundleId) {
        toast.success('Actualizacion descargada', {
          id: OTA_TOAST_ID,
          description: 'Se aplicara al reiniciar la app.',
        });
      }
    } catch (error) {
      logger.warn('OTA check failed; continuing with current bundle', error);
    } finally {
      updateCheckPromise = null;
    }
  })();

  return updateCheckPromise;
};

export const startLiveUpdateService = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  if (!startupPromise) {
    startupPromise = (async () => {
      await notifyCurrentBundleReady();
      await checkForLiveUpdate();

      await CapacitorApp.addListener('resume', () => {
        void (async () => {
          await notifyCurrentBundleReady();
          await checkForLiveUpdate();
        })();
      });
    })().catch((error) => {
      startupPromise = null;
      logger.warn('Live update service failed to initialize', error);
    });
  }

  await startupPromise;
};
