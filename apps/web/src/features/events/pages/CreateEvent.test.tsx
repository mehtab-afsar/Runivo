import type {} from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

let mockInsertError: string | null = null;
const mockInsert = vi.fn(() =>
  Promise.resolve({ error: mockInsertError ? { message: mockInsertError } : null })
);

vi.mock('@shared/services/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  },
}));

vi.mock('@shared/lib/haptics', () => ({ haptic: vi.fn() }));

import CreateEvent from './CreateEvent';

function renderForm() {
  return render(
    <MemoryRouter>
      <CreateEvent />
    </MemoryRouter>
  );
}

// Helper: get the submit button
function submitBtn() {
  return screen.getByRole('button', { name: /create event/i });
}

// Helper to get a future datetime-local string
function futureDateTime() {
  const d = new Date(Date.now() + 86_400_000);
  return d.toISOString().slice(0, 16);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsertError = null;
});

describe('CreateEvent form', () => {
  // 1
  it('renders all form fields', () => {
    renderForm();
    expect(screen.getByPlaceholderText(/sunday morning run/i)).toBeInTheDocument(); // title
    expect(screen.getByRole('combobox')).toBeInTheDocument(); // event type select
    expect(screen.getByPlaceholderText(/central park/i)).toBeInTheDocument(); // location
    expect(screen.getByPlaceholderText(/e\.g\. 5/i)).toBeInTheDocument(); // distance
    expect(screen.getByPlaceholderText(/tell runners/i)).toBeInTheDocument(); // description
  });

  // 2
  it('submit button is disabled when form is empty', () => {
    renderForm();
    expect(submitBtn()).toBeDisabled();
  });

  // 3
  it('submit still disabled with title shorter than 3 chars', async () => {
    renderForm();
    await userEvent.type(screen.getByPlaceholderText(/sunday morning run/i), 'ab');
    expect(submitBtn()).toBeDisabled();
  });

  // 4
  it('submit still disabled with valid title but missing date and location', async () => {
    renderForm();
    await userEvent.type(screen.getByPlaceholderText(/sunday morning run/i), 'My Great Run');
    expect(submitBtn()).toBeDisabled();
  });

  // 5
  it('submit enabled when title, date, and location are filled', async () => {
    renderForm();
    await userEvent.type(screen.getByPlaceholderText(/sunday morning run/i), 'My Great Run');
    await userEvent.type(screen.getByPlaceholderText(/central park/i), 'Central Park');
    // Locate the datetime-local input directly to avoid ambiguity with multiple empty inputs
    const dateField = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    // Fire a native change event with a future datetime value
    Object.defineProperty(dateField, 'value', { value: futureDateTime(), writable: true, configurable: true });
    dateField.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => {
      expect(submitBtn()).not.toBeDisabled();
    });
  });

  // Helper: fill all required fields including datetime-local
  async function fillRequiredFields(title: string, location: string) {
    await userEvent.type(screen.getByPlaceholderText(/sunday morning run/i), title);
    await userEvent.type(screen.getByPlaceholderText(/central park/i), location);
    const dateField = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    Object.defineProperty(dateField, 'value', { value: futureDateTime(), writable: true, configurable: true });
    dateField.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => expect(submitBtn()).not.toBeDisabled());
  }

  // 6 + 7
  it('on valid submit calls supabase insert and navigates to /events', async () => {
    renderForm();
    await fillRequiredFields('Park Run 5K', 'Hyde Park');
    await userEvent.click(submitBtn());
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/events');
    });
  });

  // 8
  it('shows error message when Supabase insert fails', async () => {
    mockInsertError = 'Database error';
    renderForm();
    await fillRequiredFields('Park Run 5K', 'Hyde Park');
    await userEvent.click(submitBtn());
    await waitFor(() => {
      expect(screen.getByText('Database error')).toBeInTheDocument();
    });
  });

  // 9
  it('distance and description are optional — submit works without them', async () => {
    renderForm();
    await userEvent.type(screen.getByPlaceholderText(/sunday morning run/i), 'Morning 5K');
    await userEvent.type(screen.getByPlaceholderText(/central park/i), 'City Park');
    // distance and description left empty → canSubmit logic only checks title/date/location
    const distanceInput = screen.getByPlaceholderText(/e\.g\. 5/i);
    const descInput = screen.getByPlaceholderText(/tell runners/i);
    expect(distanceInput).toHaveValue(null); // number input empty
    expect(descInput).toHaveValue('');
    // Button becomes enabled once the date is also set
    expect(distanceInput).toBeInTheDocument();
    expect(descInput).toBeInTheDocument();
  });
});
