import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnimatedProgress } from '@/components/services/AnimatedProgress';

describe('AnimatedProgress', () => {
  it('keeps the progress fill clipped inside its bounds', () => {
    render(<AnimatedProgress value={40} showPulse={false} />);

    const progressbar = screen.getByRole('progressbar', { name: 'Progreso de carga' });
    expect(progressbar).toHaveClass('overflow-hidden');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });
});
