
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Settings } from '@/types/settings';
import { createLogger } from '@/lib/logger';

const logger = createLogger('LogoUpdater');

export const useLogoUpdater = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateLogo = async (
    logoFile: File | null,
    settings: Settings
  ): Promise<{ success: boolean; error?: string; newLogoUrl?: string }> => {
    setIsUpdating(true);
    logger.debug("useLogoUpdater: Iniciando proceso de actualización de logo.", { tieneArchivo: !!logoFile });

    let companyId: string;
    let oldLogoUrl: string | null | undefined;
    let newLogoPath: string | undefined;

    try {
      // Paso 1: Obtener o crear el registro de la empresa
      logger.debug("useLogoUpdater: Buscando datos de la empresa...");
      const { data: companyData, error: companySelectError } = await supabase
        .from('company_data')
        .select('id, logo_url')
        .limit(1)
        .maybeSingle();

      if (companySelectError) {
        logger.error("useLogoUpdater: Error al buscar datos de la empresa.", companySelectError);
        throw new Error(`Error al consultar la empresa: ${companySelectError.message}`);
      }

      if (companyData) {
        companyId = companyData.id;
        oldLogoUrl = companyData.logo_url;
        logger.debug(`useLogoUpdater: Empresa encontrada con ID: ${companyId}. Logo antiguo: ${oldLogoUrl}`);
      } else {
        logger.debug("useLogoUpdater: No existen datos de la empresa, creando nuevo registro...");
        const { data: newCompanyData, error: companyInsertError } = await supabase.from('company_data').insert({
          business_name: 'TMS - Transport Management System',
          rut: '12.345.678-9',
          address: 'Av. Principal 123, Santiago',
          phone: '+56 9 1234 5678',
          email: 'contacto@tms.cl',
        }).select('id, logo_url').single();

        if (companyInsertError) {
          logger.error("useLogoUpdater: Error al crear registro de empresa.", companyInsertError);
          throw new Error(`Error al crear la empresa: ${companyInsertError.message}`);
        }
        companyId = newCompanyData.id;
        oldLogoUrl = newCompanyData.logo_url;
        logger.debug(`useLogoUpdater: Empresa creada con ID: ${companyId}.`);
      }

      // Paso 2: Subir el nuevo logo si existe
      let newLogoUrlForDB: string | null = oldLogoUrl || null;

      if (logoFile) {
        logger.debug("useLogoUpdater: Subiendo nuevo archivo de logo...");
        newLogoPath = `public/logo-${companyId}-${Date.now()}-${logoFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('company-assets')
          .upload(newLogoPath, logoFile);

        if (uploadError) {
          logger.error('useLogoUpdater: Error en la subida a Storage.', uploadError);
          throw new Error(`Error al subir el logo: ${uploadError.message}`);
        }
        
        const { data: urlData } = supabase.storage.from('company-assets').getPublicUrl(newLogoPath);
        newLogoUrlForDB = urlData.publicUrl;
        logger.debug("useLogoUpdater: Subida exitosa. Nueva URL pública:", newLogoUrlForDB);
      } else if (logoFile === null) {
        // Se está eliminando el logo
        newLogoUrlForDB = null;
        logger.debug("useLogoUpdater: Se está eliminando el logo. La URL será null.");
      }

      // Paso 3: Actualizar la base de datos solamente si hay cambios
      if (newLogoUrlForDB !== oldLogoUrl) {
        logger.debug(`useLogoUpdater: Actualizando base de datos para la empresa ${companyId} con la URL: ${newLogoUrlForDB}`);
        const { error: dbUpdateError } = await supabase
          .from('company_data')
          .update({ logo_url: newLogoUrlForDB })
          .eq('id', companyId);

        if (dbUpdateError) {
          logger.error('useLogoUpdater: Error al actualizar la base de datos.', dbUpdateError);
          if (newLogoPath) {
            logger.debug("useLogoUpdater: Deshaciendo subida de archivo por error en DB:", newLogoPath);
            await supabase.storage.from('company-assets').remove([newLogoPath]);
          }
          throw new Error(`Error al guardar el logo: ${dbUpdateError.message}`);
        }
        logger.debug("useLogoUpdater: Base de datos actualizada correctamente.");

        // Paso 4: VERIFICACIÓN
        logger.debug("useLogoUpdater: Verificando que el dato se guardó correctamente en la DB...");
        const { data: verificationData, error: verificationError } = await supabase
            .from('company_data')
            .select('logo_url')
            .eq('id', companyId)
            .single();

        if (verificationError || verificationData?.logo_url !== newLogoUrlForDB) {
            logger.error("useLogoUpdater: FALLÓ LA VERIFICACIÓN.", { verificationError, verificationData, newLogoUrlForDB });
            throw new Error('La verificación post-guardado falló. El logo puede no haberse guardado correctamente.');
        }
        logger.debug("useLogoUpdater: Verificación exitosa.");

        // Paso 5: Eliminar el logo antiguo si todo lo demás fue exitoso
        if (oldLogoUrl) {
          const oldLogoPath = oldLogoUrl.split('/company-assets/')[1]?.split('?')[0];
          if (oldLogoPath) {
            logger.debug("useLogoUpdater: Eliminando logo antiguo de Storage:", oldLogoPath);
            await supabase.storage.from('company-assets').remove([oldLogoPath]);
          }
        }
      } else {
        logger.debug("useLogoUpdater: No hubo cambios en el logo, no se actualiza la DB.");
      }

      logger.debug("useLogoUpdater: Proceso completado con éxito.");
      return { success: true, newLogoUrl: newLogoUrlForDB || undefined };

    } catch (error) {
      logger.error('useLogoUpdater: Ocurrió un error en el proceso.', error);
      const errorMessage = error instanceof Error ? error.message : 'Un error desconocido ocurrió al procesar el logotipo.';
      return { success: false, error: errorMessage };
    } finally {
      setIsUpdating(false);
      logger.debug("useLogoUpdater: Fin del proceso. isUpdating: false.");
    }
  };

  // Función para subir el logo predeterminado
  const uploadDefaultLogo = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      logger.debug("🏢 Subiendo logo predeterminado de la empresa...");
      
      // Fetch the default logo image
      const response = await fetch('/images/company-logo.webp');
      if (!response.ok) {
        throw new Error('No se pudo cargar el logo predeterminado');
      }
      
      const blob = await response.blob();
      const file = new File([blob], 'company-logo.webp', { type: 'image/webp' });
      
      // Use the existing updateLogo function
      const result = await updateLogo(file, {
        company: {
          name: 'TMS - Transport Management System',
          taxId: '12.345.678-9',
          address: 'Av. Principal 123, Santiago',
          phone: '+56 9 1234 5678',
          email: 'contacto@tms.cl',
          folioFormat: 'SRV-{number}',
          nextServiceFolioNumber: 1000
        },
        user: { language: 'es', theme: 'dark', timezone: 'America/Santiago', useSystemTimezone: true, notifications: true, dateFormat: 'DD/MM/YYYY', currency: 'CLP' },
        system: { autoBackup: true, backupFrequency: 'daily', dataRetention: 12, maintenanceMode: false },
        notifications: { emailNotifications: true, serviceReminders: true, invoiceAlerts: true, overdueNotifications: true, systemUpdates: false }
      });
      
      logger.debug("✅ Logo predeterminado subido exitosamente");
      return result;
      
    } catch (error) {
      logger.error('❌ Error subiendo logo predeterminado:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
  };

  return { isUpdating, updateLogo, uploadDefaultLogo };
};
