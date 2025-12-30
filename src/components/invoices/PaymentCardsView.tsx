import { PaymentWithDetails } from '@/types/payments';
import { PaymentCard } from './PaymentCard';

interface PaymentCardsViewProps {
  payments: PaymentWithDetails[];
  onManualApplication: (payment: PaymentWithDetails) => void;
  onSelectiveApplication: (payment: PaymentWithDetails) => void;
  onViewDetail: (payment: PaymentWithDetails) => void;
  showSensitiveData?: boolean;
}

export const PaymentCardsView = ({
  payments,
  onManualApplication,
  onSelectiveApplication,
  onViewDetail,
  showSensitiveData = true,
}: PaymentCardsViewProps) => {
  if (payments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No hay pagos registrados
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {payments.map((payment) => (
        <PaymentCard
          key={payment.id}
          payment={payment}
          onManualApplication={onManualApplication}
          onSelectiveApplication={onSelectiveApplication}
          onViewDetail={onViewDetail}
          showSensitiveData={showSensitiveData}
        />
      ))}
    </div>
  );
};
