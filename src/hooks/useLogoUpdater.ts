
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Settings } from '@/types/settings';

export const useLogoUpdater = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateLogo = async (
    logoFile: File | null,
    settings: Settings
  ): Promise<{ success: boolean; error?: string; newLogoUrl?: string }> => {
    if (!settings) {
      console.error("updateLogo: Settings not provided.");
      return { success: false, error: 'Configuración no cargada.' };
    }
    setIsUpdating(true);
    console.log("updateLogo: Starting logo update process.", { hasFile: !!logoFile });

    let newLogoPath: string | undefined = undefined;

    try {
      // Paso 1: Obtener o crear la entrada de datos de la empresa.
      console.log("updateLogo: Step 1 - Get or create company data entry.");
      let { data: companyData, error: companySelectError } = await supabase
        .from('company_data')
        .select('id, logo_url')
        .limit(1)
        .maybeSingle();
      
      if (companySelectError) {
        console.error("updateLogo: Error fetching company data.", companySelectError);
        throw new Error(`Error al consultar datos de la empresa: ${companySelectError.message}`);
      }
      
      console.log("updateLogo: Fetched company data:", companyData);

      if (!companyData) {
        console.log("updateLogo: No company data found, creating new entry.");
        const { data: newCompanyData, error: companyInsertError } = await supabase.from('company_data').insert({
          business_name: settings.company.name,
          rut: settings.company.taxId,
          address: settings.company.address,
          phone: settings.company.phone,
          email: settings.company.email,
        }).select('id, logo_url').single();

        if (companyInsertError) {
          console.error("updateLogo: Error inserting new company data.", companyInsertError);
          throw new Error(`Error al crear registro para la empresa: ${companyInsertError.message}`);
        }
        companyData = newCompanyData;
        console.log("updateLogo: New company data created:", companyData);
      }
      
      const oldLogoUrl = companyData.logo_url;
      let newLogoUrl: string | undefined = undefined;

      // Paso 2: Subir el nuevo archivo de logo si existe.
      if (logoFile) {
        console.log("updateLogo: Step 2 - New logo file provided. Uploading...");
        const filePath = `public/logo-${Date.now()}-${logoFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('company-assets')
          .upload(filePath, logoFile, { upsert: false });

        if (uploadError) {
          console.error('updateLogo: Storage upload error:', uploadError);
          throw new Error(`Error al subir el nuevo logotipo: ${uploadError.message}`);
        }
        
        newLogoPath = uploadData.path;
        console.log("updateLogo: Upload successful. Path:", newLogoPath);

        const { data: urlData } = supabase.storage
          .from('company-assets')
          .getPublicUrl(newLogoPath);
        
        newLogoUrl = urlData.publicUrl;
        console.log("updateLogo: New public URL for DB:", newLogoUrl);
      } else {
        console.log("updateLogo: Step 2 - No logo file provided, this means removal.");
        // newLogoUrl se mantiene como undefined para borrarlo de la DB.
      }
      
      // Paso 3: Actualizar la base de datos con la URL del nuevo logo.
      console.log(`updateLogo: Step 3 - Updating DB for company ID ${companyData.id} with logo URL: ${newLogoUrl}`);
      const { error: dbError } = await supabase
        .from('company_data')
        .update({ logo_url: newLogoUrl })
        .eq('id', companyData.id);

      if (dbError) {
        console.error('updateLogo: Database update error:', dbError);
        // Si la actualización de la DB falla, se elimina el archivo recién subido para no dejar huérfanos.
        if (newLogoPath) {
            console.log("updateLogo: Rolling back upload. Removing:", newLogoPath);
            await supabase.storage.from('company-assets').remove([newLogoPath]);
        }
        throw new Error(`Error al guardar la URL del logotipo: ${dbError.message}`);
      }
      console.log("updateLogo: Database updated successfully.");

      // Paso 4: Eliminar el logo antiguo del almacenamiento si corresponde.
      if (oldLogoUrl) {
        const oldLogoPath = oldLogoUrl.split('/company-assets/')[1]?.split('?')[0];
        if (oldLogoPath && oldLogoPath !== newLogoPath) {
          console.log("updateLogo: Step 4 - Removing old logo from storage:", oldLogoPath);
          const { error: removeError } = await supabase.storage.from('company-assets').remove([oldLogoPath]);
          if (removeError) {
             // Es un error no crítico, lo registramos pero no detenemos el proceso.
             console.error("updateLogo: Failed to remove old logo, but operation succeeded.", removeError);
          }
        }
      }

      console.log("updateLogo: Process completed successfully.");
      return { success: true, newLogoUrl };

    } catch (error) {
      console.error('updateLogo: An error occurred in the process.', error);
      const errorMessage = error instanceof Error ? error.message : 'Un error desconocido ocurrió al guardar el logotipo.';
      return { success: false, error: errorMessage };
    } finally {
      setIsUpdating(false);
      console.log("updateLogo: Finished. isUpdating state is now false.");
    }
  };

  return { isUpdating, updateLogo };
};
