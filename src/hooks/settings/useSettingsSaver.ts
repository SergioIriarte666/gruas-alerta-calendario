
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Settings } from '@/types/settings';

interface CompanyDataPayload {
  business_name: string;
  address: string;
  phone: string;
  email: string;
  rut: string;
  logo_url?: string | null;
  folio_format?: string;
  next_service_folio_number?: number;
}

export const useSettingsSaver = () => {
  const [saving, setSaving] = useState(false);

  const saveSettings = async (settings: Settings) => {
    if (!settings) return { success: false, error: 'Configuración no cargada.' };

    setSaving(true);
    try {
      const companyPayload: CompanyDataPayload = {
        business_name: settings.company.name || '',
        address: settings.company.address || '',
        phone: settings.company.phone || '',
        email: settings.company.email || '',
        rut: settings.company.taxId || '',
        logo_url:
          typeof settings.company.logo === 'string'
            ? settings.company.logo
            : null,
        folio_format: settings.company.folioFormat || 'SRV-{number}',
        next_service_folio_number: settings.company.nextServiceFolioNumber || 1000,
      };

      console.log('Intentando guardar datos de empresa (payload enviado):', companyPayload);

      const { data: existingCompany, error: selectError } = await supabase
        .from('company_data')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (selectError) {
        console.error('Error al consultar company_data:', selectError);
        throw selectError;
      }

      if (existingCompany && existingCompany.id) {
        const { error: updateError } = await supabase
          .from('company_data')
          .update(companyPayload)
          .eq('id', existingCompany.id);

        if (updateError) {
          console.error('Error al actualizar la empresa:', updateError);
          throw updateError;
        }
        console.log('Empresa actualizada correctamente');

      } else {
        const { data: newCompany, error: insertError } = await supabase
          .from('company_data')
          .insert([companyPayload] as CompanyDataPayload[])
          .select()
          .maybeSingle();

        if (insertError) {
          console.error('Error al insertar empresa:', insertError);
          throw insertError;
        }
        if (!newCompany || !newCompany.id) {
          throw new Error('No se pudo crear el registro de empresa');
        }
        console.log('Empresa creada correctamente:', newCompany.id);
      }

      // Otros settings a local storage (user, system, notifications)
      const { company, ...otherSettings } = settings;
      localStorage.setItem('tms-settings-others', JSON.stringify(otherSettings));
      localStorage.removeItem('tms-settings');

      setTimeout(() => {
        window.dispatchEvent(new Event('settings-updated'));
      }, 350);

      return { success: true };
    } catch (error: any) {
      console.error('Error saving settings:', error);
      return { success: false, error: 'Error al guardar la configuración: ' + (error?.message || 'Desconocido') };
    } finally {
      setSaving(false);
    }
  };

  return { saveSettings, saving };
};
