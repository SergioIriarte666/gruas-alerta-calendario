
import { ReactNode } from 'react';

export const OperatorLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="bg-slate-900 min-h-screen text-white selection:bg-tms-green/30">
      <div className="container mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
};
