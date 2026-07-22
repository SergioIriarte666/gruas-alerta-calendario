import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OperatorAppAccessBadge, OperatorSelectLabel } from '../OperatorAppAccessBadge';

describe('OperatorAppAccessBadge', () => {
  it('identifica una ficha activa que no tiene una cuenta vinculada', () => {
    render(<OperatorAppAccessBadge operator={{ name: 'Operador de prueba', userId: null }} />);

    expect(screen.getByText('Sin acceso a la app')).toBeInTheDocument();
  });

  it('no muestra advertencia cuando el operador tiene acceso', () => {
    render(<OperatorAppAccessBadge operator={{ name: 'Operador de prueba', userId: 'user-123' }} />);

    expect(screen.queryByText('Sin acceso a la app')).not.toBeInTheDocument();
  });

  it('mantiene el nombre visible dentro de los selectores', () => {
    render(<OperatorSelectLabel operator={{ name: 'Juan Operador', userId: null }} />);

    expect(screen.getByText('Juan Operador')).toBeInTheDocument();
    expect(screen.getByText('Sin acceso a la app')).toBeInTheDocument();
  });
});
