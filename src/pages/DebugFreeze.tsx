
import React, { useState, useEffect } from 'react';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function DebugFreeze() {
  const [showForm, setShowForm] = useState(false);
  const [preselectedClosureId, setPreselectedClosureId] = useState<string | null>(null);

  const handleStart = () => {
    // Set a dummy ID to simulate navigation from closures
    setPreselectedClosureId('dummy-closure-id');
    setShowForm(true);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Freeze Page</h1>
      <div className="mb-4 space-x-4">
        <Button onClick={handleStart}>
          Simulate "Generate Invoice" from Closure
        </Button>
        <Button onClick={() => setShowForm(false)} variant="outline">
          Reset
        </Button>
      </div>

      {showForm && (
        <div className="border p-4 rounded bg-gray-50">
          <h2 className="mb-2 font-semibold">Invoice Form Container</h2>
          <InvoiceForm 
            preselectedClosureId={preselectedClosureId}
            onSubmit={(data) => console.log('Submit:', data)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}
    </div>
  );
}
