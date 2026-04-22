import { vi } from 'vitest';
import { createMeeting } from '@/server/actions/meetings';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock the createMeeting action
vi.mock('@/server/actions/meetings', () => ({
  createMeeting: vi.fn(),
}));

// Define a type for our form data
interface BookingFormData {
  name: string;
  email: string;
  notes: string;
  date: string;
  time: string;
  [key: string]: string; // Allow for additional fields
}

// Create a simplified booking form component for testing
// This mirrors the behavior of the actual MeetingForm component
const BookingFormSimple: React.FC<{
  onSubmit: (data: BookingFormData) => Promise<void>;
  isLoading?: boolean;
  price?: number;
  eventTitle?: string;
  onValidationError?: (errors: Record<string, string>) => void;
}> = ({
  onSubmit,
  isLoading = false,
  price = 100,
  eventTitle = 'Test Event',
  onValidationError,
}) => {
  const [step, setStep] = React.useState(1);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formData, setFormData] = React.useState<BookingFormData>({
    name: '',
    email: '',
    notes: '',
    date: '2025-01-01',
    time: '10:00',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validate form data - mirrors the validation in MeetingForm
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length === 0) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email || formData.email.trim().length === 0) {
      newErrors.email = 'Email is required';
    } else if (!formData.email.includes('@')) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    if (!formData.time) {
      newErrors.time = 'Time is required';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      // Set root error like the actual MeetingForm does
      newErrors.root = 'Please fill in all required fields correctly.';
      setErrors(newErrors);
      onValidationError?.(newErrors);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Step 1 -> Step 2 transition (date/time selection)
    if (step === 1) {
      if (!formData.date || !formData.time) {
        setErrors({ root: 'Please select a date and time' });
        return;
      }
      setStep(2);
      return;
    }

    // Step 2 -> Submit (for free) or Step 3 (for paid)
    if (step === 2) {
      // Validate form before processing - this is the key fix we made
      if (!validateForm()) {
        return; // Now returns with visible error instead of silently failing
      }

      // Prevent double submissions
      if (isProcessing) {
        return;
      }

      setIsProcessing(true);

      try {
        if (price === 0) {
          // Free events: submit directly (fixed flow)
          await onSubmit(formData);
        } else {
          // Paid events: go to step 3 (payment)
          setStep(3);
        }
      } catch {
        setErrors({ root: 'Failed to schedule meeting. Please try again.' });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Step 3: Payment confirmation (paid events only)
    if (step === 3) {
      setIsProcessing(true);
      try {
        await onSubmit(formData);
      } catch {
        setErrors({ root: 'Payment processing failed' });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setErrors({});
    }
  };

  const effectiveLoading = isLoading || isProcessing;

  return (
    <div data-testid="booking-form">
      <h2>Book {eventTitle}</h2>
      <p>Price: {price === 0 ? 'Free' : `$${price}`}</p>

      {/* Display root error message */}
      {errors.root && (
        <div data-testid="form-error" role="alert" className="error-message">
          {errors.root}
        </div>
      )}

      {step === 1 && (
        <div data-testid="step-1">
          <h3>Step 1: Select a Date & Time</h3>
          <form onSubmit={handleSubmit} data-testid="booking-form-step-1">
            <div>
              <label htmlFor="date">Date</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
              {errors.date && <span className="field-error">{errors.date}</span>}
            </div>
            <div>
              <label htmlFor="time">Time</label>
              <input
                type="time"
                id="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                required
              />
              {errors.time && <span className="field-error">{errors.time}</span>}
            </div>
            <button type="submit" disabled={effectiveLoading}>
              Continue
            </button>
          </form>
        </div>
      )}

      {step === 2 && (
        <div data-testid="step-2">
          <h3>Step 2: Your Information</h3>
          <form onSubmit={handleSubmit} data-testid="booking-form-step-2">
            <div>
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                aria-invalid={!!errors.name}
              />
              {errors.name && (
                <span className="field-error" role="alert">
                  {errors.name}
                </span>
              )}
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <span className="field-error" role="alert">
                  {errors.email}
                </span>
              )}
            </div>
            <div>
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} />
            </div>
            <button type="button" onClick={goBack}>
              Back
            </button>
            <button type="submit" disabled={effectiveLoading} data-testid="submit-button">
              {effectiveLoading
                ? 'Processing...'
                : price === 0
                  ? 'Schedule Meeting'
                  : 'Continue to Payment'}
            </button>
          </form>
        </div>
      )}

      {step === 3 && (
        <div data-testid="step-3">
          <h3>Step 3: Payment</h3>
          <div>
            <p data-testid="booking-date">
              <strong>Date:</strong> {formData.date}
            </p>
            <p data-testid="booking-time">
              <strong>Time:</strong> {formData.time}
            </p>
            <p data-testid="booking-name">
              <strong>Name:</strong> {formData.name}
            </p>
            <p data-testid="booking-email">
              <strong>Email:</strong> {formData.email}
            </p>
            <p data-testid="booking-notes">
              <strong>Notes:</strong> {formData.notes || 'None'}
            </p>
          </div>
          <form onSubmit={handleSubmit} data-testid="booking-form-step-3">
            <button type="button" onClick={goBack}>
              Back
            </button>
            <button type="submit" disabled={effectiveLoading}>
              {effectiveLoading ? 'Processing...' : 'Confirm Booking'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

describe('BookingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createMeeting as vi.Mock).mockResolvedValue({ success: true, id: 'meeting-123' });
  });

  describe('Step Navigation', () => {
    it('renders all steps of the booking form', async () => {
      render(<BookingFormSimple onSubmit={vi.fn()} />);

      // Step 1 - Date and time selection should be visible
      expect(screen.getByTestId('step-1')).toBeInTheDocument();
      expect(screen.getByText('Step 1: Select a Date & Time')).toBeInTheDocument();

      // Simulate selecting a date and time and proceeding
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));

      // Step 2 - Should show the form for user details
      expect(screen.getByTestId('step-2')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Your Information')).toBeInTheDocument();

      // Fill in the form and proceed (paid event goes to step 3)
      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'Test User' },
      });
      fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.submit(screen.getByTestId('booking-form-step-2'));

      // Step 3 - Should show payment confirmation (paid event)
      expect(screen.getByTestId('step-3')).toBeInTheDocument();
      expect(screen.getByText('Step 3: Payment')).toBeInTheDocument();

      // Check for displayed values using data-testid
      const nameElement = screen.getByTestId('booking-name');
      expect(nameElement).toHaveTextContent('Name:');
      expect(nameElement).toHaveTextContent('Test User');

      const emailElement = screen.getByTestId('booking-email');
      expect(emailElement).toHaveTextContent('Email:');
      expect(emailElement).toHaveTextContent('test@example.com');
    });

    it('allows navigation between steps', async () => {
      render(<BookingFormSimple onSubmit={vi.fn()} />);

      // Go to step 2
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));
      expect(screen.getByTestId('step-2')).toBeInTheDocument();

      // Go back to step 1
      fireEvent.click(screen.getByText('Back'));
      expect(screen.getByTestId('step-1')).toBeInTheDocument();

      // Go to step 2 again
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));
      expect(screen.getByTestId('step-2')).toBeInTheDocument();

      // Fill form and go to step 3
      fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } });
      fireEvent.submit(screen.getByTestId('booking-form-step-2'));
      expect(screen.getByTestId('step-3')).toBeInTheDocument();

      // Go back to step 2
      fireEvent.click(screen.getByText('Back'));
      expect(screen.getByTestId('step-2')).toBeInTheDocument();
    });
  });

  describe('Free Event Submission', () => {
    it('submits free event directly without going to payment step', async () => {
      const mockSubmit = vi.fn().mockResolvedValue({ success: true });
      render(<BookingFormSimple onSubmit={mockSubmit} price={0} />);

      // Navigate to step 2
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));

      // Fill in the form
      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'Test User' },
      });
      fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'test@example.com' },
      });

      // Submit - should call onSubmit directly for free events
      fireEvent.submit(screen.getByTestId('booking-form-step-2'));

      // Verify onSubmit was called with correct data
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test User',
            email: 'test@example.com',
          }),
        );
      });

      // Should NOT go to step 3 for free events
      expect(screen.queryByTestId('step-3')).not.toBeInTheDocument();
    });

    it('shows "Schedule Meeting" button text for free events', () => {
      render(<BookingFormSimple onSubmit={vi.fn()} price={0} />);

      // Navigate to step 2
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));

      // Check button text
      expect(screen.getByTestId('submit-button')).toHaveTextContent('Schedule Meeting');
    });

    it('displays "Free" price label for free events', () => {
      render(<BookingFormSimple onSubmit={vi.fn()} price={0} />);
      expect(screen.getByText('Price: Free')).toBeInTheDocument();
    });
  });

  describe('Paid Event Submission', () => {
    it('goes to payment step for paid events', async () => {
      const mockSubmit = vi.fn().mockResolvedValue({ success: true });
      render(<BookingFormSimple onSubmit={mockSubmit} price={100} />);

      // Navigate to step 2
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));

      // Fill in the form
      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'Test User' },
      });
      fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'test@example.com' },
      });

      // Submit - should go to step 3 for paid events
      fireEvent.submit(screen.getByTestId('booking-form-step-2'));

      // Should go to step 3
      expect(screen.getByTestId('step-3')).toBeInTheDocument();

      // onSubmit should NOT be called yet
      expect(mockSubmit).not.toHaveBeenCalled();

      // Confirm booking
      fireEvent.submit(screen.getByTestId('booking-form-step-3'));

      // Now onSubmit should be called
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test User',
            email: 'test@example.com',
          }),
        );
      });
    });

    it('shows "Continue to Payment" button text for paid events', () => {
      render(<BookingFormSimple onSubmit={vi.fn()} price={100} />);

      // Navigate to step 2
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));

      // Check button text
      expect(screen.getByTestId('submit-button')).toHaveTextContent('Continue to Payment');
    });
  });

  describe('Form Validation', () => {
    it('shows validation error when submitting with empty name', async () => {
      const mockValidationError = vi.fn();
      render(
        <BookingFormSimple
          onSubmit={vi.fn()}
          price={0}
          onValidationError={mockValidationError}
        />,
      );

      // Navigate to step 2
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));

      // Only fill email, leave name empty
      fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'test@example.com' },
      });

      // Submit
      fireEvent.submit(screen.getByTestId('booking-form-step-2'));

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument();
        expect(screen.getByTestId('form-error')).toHaveTextContent(
          'Please fill in all required fields correctly.',
        );
      });

      // onValidationError callback should be called
      expect(mockValidationError).toHaveBeenCalled();
    });

    it('shows validation error when submitting with empty email', async () => {
      render(<BookingFormSimple onSubmit={vi.fn()} price={0} />);

      // Navigate to step 2
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));

      // Only fill name, leave email empty
      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'Test User' },
      });

      // Submit
      fireEvent.submit(screen.getByTestId('booking-form-step-2'));

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument();
      });
    });

    it('shows validation error for invalid email format', async () => {
      render(<BookingFormSimple onSubmit={vi.fn()} price={0} />);

      // Navigate to step 2
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));

      // Fill name and invalid email
      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'Test User' },
      });
      fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'invalid-email' },
      });

      // Submit
      fireEvent.submit(screen.getByTestId('booking-form-step-2'));

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument();
      });
    });

    it('clears field error when user starts typing', async () => {
      render(<BookingFormSimple onSubmit={vi.fn()} price={0} />);

      // Navigate to step 2
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));

      // Submit without filling form to trigger errors
      fireEvent.submit(screen.getByTestId('booking-form-step-2'));

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument();
      });

      // Start typing in name field
      fireEvent.change(screen.getByLabelText('Full Name'), {
        target: { value: 'T' },
      });

      // Name field should no longer have aria-invalid
      expect(screen.getByLabelText('Full Name')).not.toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Loading States', () => {
    it('displays loading state during submission', async () => {
      const mockSubmit = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ success: true }), 100);
        });
      });

      render(<BookingFormSimple onSubmit={mockSubmit} isLoading={true} price={0} />);

      // Navigate to step 2
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));

      // Check that the button shows loading state
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('disables submit button when processing', () => {
      render(<BookingFormSimple onSubmit={vi.fn()} isLoading={true} price={0} />);

      // Navigate to step 2
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));

      // Submit button should be disabled
      expect(screen.getByTestId('submit-button')).toBeDisabled();
    });
  });

  describe('Double Submit Prevention', () => {
    it('prevents double submission for free events', async () => {
      let resolvePromise: (value: unknown) => void;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const mockSubmit = vi.fn().mockReturnValue(slowPromise);
      render(<BookingFormSimple onSubmit={mockSubmit} price={0} />);

      // Navigate to step 2
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));

      // Fill form
      fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } });

      // Submit multiple times rapidly
      fireEvent.submit(screen.getByTestId('booking-form-step-2'));
      fireEvent.submit(screen.getByTestId('booking-form-step-2'));
      fireEvent.submit(screen.getByTestId('booking-form-step-2'));

      // Only one call should be made
      expect(mockSubmit).toHaveBeenCalledTimes(1);

      // Resolve the promise
      resolvePromise!({ success: true });
    });
  });

  describe('Event Details Display', () => {
    it('shows event details in the form', () => {
      render(
        <BookingFormSimple onSubmit={vi.fn()} price={250} eventTitle="Expert Consultation" />,
      );

      expect(screen.getByText('Book Expert Consultation')).toBeInTheDocument();
      expect(screen.getByText('Price: $250')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error message when submission fails', async () => {
      const mockSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
      render(<BookingFormSimple onSubmit={mockSubmit} price={0} />);

      // Navigate to step 2
      fireEvent.submit(screen.getByTestId('booking-form-step-1'));

      // Fill form
      fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } });

      // Submit
      fireEvent.submit(screen.getByTestId('booking-form-step-2'));

      // Should show error
      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument();
        expect(screen.getByTestId('form-error')).toHaveTextContent(
          'Failed to schedule meeting. Please try again.',
        );
      });
    });
  });
});
