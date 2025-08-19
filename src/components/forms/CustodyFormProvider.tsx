import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createServiceFormSchema } from '@/schemas/serviceSchema';

interface CustodyFormProviderProps {
  children: React.ReactNode;
  defaultValues: any;
  onSubmit: (data: any) => void;
}

export const CustodyFormProvider = ({ children, defaultValues, onSubmit }: CustodyFormProviderProps) => {
  const methods = useForm({
    resolver: zodResolver(createServiceFormSchema()),
    defaultValues
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        {children}
      </form>
    </FormProvider>
  );
};