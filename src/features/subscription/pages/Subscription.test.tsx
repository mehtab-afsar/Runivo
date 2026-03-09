import type {} from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ── Mock Supabase ─────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

let mockTier = 'free';
vi.mock('@shared/services/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: { subscription_tier: mockTier }, error: null })),
    })),
  },
}));

import Subscription from './Subscription';

function renderSub() {
  return render(
    <MemoryRouter>
      <Subscription />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTier = 'free';
});

describe('Subscription page', () => {
  // 1
  it('renders the "Upgrade Runivo" heading', async () => {
    renderSub();
    expect(await screen.findByText('Upgrade Runivo')).toBeInTheDocument();
  });

  // 2
  it('renders all 3 tier names', async () => {
    renderSub();
    expect(await screen.findByText('Runner Plus')).toBeInTheDocument();
    expect(screen.getByText('Territory Lord')).toBeInTheDocument();
    expect(screen.getByText('Empire Builder')).toBeInTheDocument();
  });

  // 3
  it('renders all 3 prices', async () => {
    renderSub();
    await screen.findByText('Runner Plus');
    expect(screen.getByText('$4.99/mo')).toBeInTheDocument();
    expect(screen.getByText('$9.99/mo')).toBeInTheDocument();
    expect(screen.getByText('$19.99/mo')).toBeInTheDocument();
  });

  // 4
  it('shows "Most Popular" badge on Territory Lord', async () => {
    renderSub();
    await screen.findByText('Runner Plus');
    expect(screen.getByText(/most popular/i)).toBeInTheDocument();
  });

  // 5
  it('shows 3 upgrade buttons for a free-tier user', async () => {
    renderSub();
    await screen.findByText('Runner Plus');
    const upgradeButtons = screen.getAllByRole('button', { name: /upgrade to/i });
    expect(upgradeButtons).toHaveLength(3);
  });

  // 6
  it('shows "Current Plan" for runner-plus and upgrade buttons for others', async () => {
    mockTier = 'runner-plus';
    renderSub();
    await waitFor(() => {
      expect(screen.getAllByText('Current Plan').length).toBeGreaterThanOrEqual(1);
    });
    const upgradeButtons = screen.getAllByRole('button', { name: /upgrade to/i });
    // Only 2 tiers should have upgrade buttons (Territory Lord + Empire Builder)
    expect(upgradeButtons).toHaveLength(2);
  });

  // 7
  it('clicking back button calls navigate(-1)', async () => {
    renderSub();
    await screen.findByText('Upgrade Runivo');
    const backBtn = screen.getByRole('button', { name: '' }); // ArrowLeft icon button
    await userEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
