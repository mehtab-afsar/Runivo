import type {} from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  // 1
  it('default variant renders label, value, and unit', () => {
    render(<StatCard label="Distance" value="5.00" unit="km" />);
    expect(screen.getByText('Distance')).toBeInTheDocument();
    expect(screen.getByText('5.00')).toBeInTheDocument();
    expect(screen.getByText('km')).toBeInTheDocument();
  });

  // 2
  it('default variant: no unit → unit element not in DOM', () => {
    const { container } = render(<StatCard label="Distance" value="5.00" />);
    // The unit span only renders when unit prop is provided
    const spans = container.querySelectorAll('span');
    const texts = Array.from(spans).map(s => (s as HTMLElement).textContent);
    expect(texts).not.toContain('km');
  });

  // 3
  it('hero variant renders with large value text', () => {
    const { container } = render(<StatCard label="Distance" value="5.00" unit="km" variant="hero" />);
    // hero variant uses text-5xl class
    const largeEl = container.querySelector('.text-5xl');
    expect(largeEl).not.toBeNull();
    expect(largeEl?.textContent).toBe('5.00');
  });

  // 4
  it('compact variant renders with text-xl class', () => {
    const { container } = render(<StatCard label="Duration" value="12:34" variant="compact" />);
    const el = container.querySelector('.text-xl');
    expect(el).not.toBeNull();
  });

  // 5
  it('trend=up renders ↑ indicator', () => {
    render(<StatCard label="Pace" value="5:30" trend="up" trendValue="+5%" />);
    expect(screen.getByText(/↑/)).toBeInTheDocument();
    expect(screen.getByText(/\+5%/)).toBeInTheDocument();
  });

  // 6
  it('trend=down renders ↓ indicator', () => {
    render(<StatCard label="Pace" value="5:30" trend="down" trendValue="-2%" />);
    expect(screen.getByText(/↓/)).toBeInTheDocument();
  });

  // 7
  it('glowColor=cyan applies teal border class', () => {
    const { container } = render(<StatCard label="Pace" value="5:30" glowColor="cyan" />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-teal-200');
  });

  // 8
  it('icon prop renders the icon node', () => {
    render(<StatCard label="Zones" value="3" icon={<span data-testid="test-icon">★</span>} />);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });
});
