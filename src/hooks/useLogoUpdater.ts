
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

    try {
      // Step 1: Get or create company data entry
      let { data: companyData, error: companySelectError } = await supabase.from('company_data').select('id, logo_url').limit(1).maybeSingle();
      if (companySelectError) {
        console.error("updateLogo: Error fetching company data.", companySelectError);
        throw new Error('Error al consultar datos de la empresa.');
      }
      
      console.log("updateLogo: Fetched company data:", companyData);

      if (!companyData) {
        console.log("updateLogo: No company data found, creating new entry with settings:", settings.company);
        const { data: newCompanyData, error: companyInsertError } = await supabase.from('company_data').insert({
          business_name: settings.company.name,
          rut: settings.company.taxId,
          address: settings.company.address,
          phone: settings.company.phone,
          email: settings.company.email,
        }).select('id, logo_url').single();

        if (companyInsertError) {
          console.error("updateLogo: Error inserting new company data.", companyInsertError);
          throw new Error('Error al crear registro para la empresa.');
        }
        companyData = newCompanyData;
        console.log("updateLogo: New company data created:", companyData);
      }
      
      const oldLogoUrl = companyData.logo_url;
      console.log("updateLogo: Old logo URL to delete (if any):", oldLogoUrl);

      let newLogoUrl: string | undefined = undefined;

      // Step 2: Handle logo file upload/removal
      if (logoFile) {
        console.log("updateLogo: New logo file provided. Uploading...");
        const filePath = `public/logo-${Date.now()}-${logoFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('company-assets')
          .upload(filePath, logoFile, { upsert: true });

        if (uploadError) {
          console.error('updateLogo: Storage upload error:', uploadError);
          throw new Error('Error al subir el nuevo logotipo.');
        }
        
        console.log("updateLogo: Upload successful. Path:", uploadData.path);

        const { data: urlData } = supabase.storage
          .from('company-assets')
          .getPublicUrl(uploadData.path);
        
        newLogoUrl = urlData.publicUrl;
        console.log("updateLogo: New public URL for DB:", newLogoUrl);
      }
      
      // Step 3: Update database with new logo URL
      console.log(`updateLogo: Updating DB for company ID ${companyData.id} with logo URL: ${newLogoUrl}`);
      const { error: dbError } = await supabase
        .from('company_data')
        .update({ logo_url: newLogoUrl })
        .eq('id', companyData.id);

      if (dbError) {
        console.error('updateLogo: Database update error:', dbError);
        // If DB update fails, try to remove the newly uploaded file to avoid orphaned files
        if (newLogoUrl) {
            const newPath = newLogoUrl.split('/company-assets/')[1];
            if (newPath) {
                console.log("updateLogo: Rolling back upload. Removing:", newPath);
                await supabase.storage.from('company-assets').remove([newPath]);
            }
        }
        throw new Error('Error al guardar la URL del logotipo en la base de datos.');
      }
      console.log("updateLogo: Database updated successfully.");

      // Step 4: Remove old logo from storage if new one was saved
      if (oldLogoUrl) {
        const oldLogoPath = oldLogoUrl.split('/company-assets/')[1]?.split('?')[0];
        const newLogoPath = newLogoUrl?.split('/company-assets/')[1]?.split('?')[0];

        if (oldLogoPath && oldLogoPath !== newLogoPath) {
          console.log("updateLogo: Removing old logo from storage:", oldLogoPath);
          const { error: removeError } = await supabase.storage.from('company-assets').remove([oldLogoPath]);
          if(removeError) {
             console.error("updateLogo: Failed to remove old logo, but continuing as new logo is set.", removeError);
          }
        }
      }

      console.log("updateLogo: Process completed successfully.");
      return { success: true, newLogoUrl: newLogoUrl };

    } catch (error) {
      console.error('updateLogo: An error occurred in the process.', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al guardar el logotipo';
      return { success: false, error: errorMessage };
    } finally {
      setIsUpdating(false);
      console.log("updateLogo: Finished. Saving state is false.");
    }
  };

  return { isUpdating, updateLogo };
};
