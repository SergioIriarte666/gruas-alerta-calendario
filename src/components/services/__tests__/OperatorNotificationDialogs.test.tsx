import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OperatorNotificationDialogs } from '../OperatorNotificationDialogs';

describe('OperatorNotificationDialogs', () => {
  it('muestra el modal de confirmacion despues de la creacion', () => {
    render(
      <OperatorNotificationDialogs
        confirmOpen={true}
        retryOpen={false}
        isSending={false}
        onConfirmSend={vi.fn()}
        onDecline={vi.fn()}
        onRetry={vi.fn()}
        onRetryCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByText('¿Desea notificar al operador asignado sobre este nuevo servicio a través de WhatsApp?'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sí' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
  });

  it('muestra el modal de reintento cuando falla el envio', () => {
    render(
      <OperatorNotificationDialogs
        confirmOpen={false}
        retryOpen={true}
        isSending={false}
        onConfirmSend={vi.fn()}
        onDecline={vi.fn()}
        onRetry={vi.fn()}
        onRetryCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByText('No se pudo enviar la notificación de WhatsApp. ¿Desea intentarlo nuevamente?'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });
});
