import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ForgotPasswordModal from './ForgotPasswordModal';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/shared/api/client', () => ({ default: { post: mocks.post } }));
beforeEach(() => { mocks.post.mockReset().mockResolvedValue({ data: {} }); });
afterEach(cleanup);

function submit(email = 'Alice@Example.com') {
  const input = screen.getByLabelText('Email address');
  fireEvent.change(input, { target: { value: email } });
  fireEvent.submit(input.closest('form')!);
}

it('submits the normalized email and shows the generic sent state only after the API responds', async () => {
  let resolve!: (value: unknown) => void;
  mocks.post.mockReturnValue(new Promise(done => { resolve = done; }));
  render(<ForgotPasswordModal isOpen onClose={vi.fn()} />);
  submit(' Alice@Example.com ');
  expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
  expect(screen.queryByText('Check your inbox')).not.toBeInTheDocument();
  expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/auth/forgot-password', { email: 'alice@example.com' }, { signal: expect.any(AbortSignal) });
  fireEvent.submit(screen.getByLabelText('Email address').closest('form')!);
  expect(mocks.post).toHaveBeenCalledOnce();
  await act(async () => resolve({ data: {} }));
  expect(screen.getByText('Check your inbox')).toBeInTheDocument();
  expect(screen.getByText(/If an account is associated/)).toBeInTheDocument();
});

it('shows a request failure and allows retry', async () => {
  mocks.post.mockRejectedValue(new Error('Network unavailable'));
  render(<ForgotPasswordModal isOpen onClose={vi.fn()} />);
  await act(async () => submit());
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to send reset instructions right now. Please try again.');
  expect(screen.getByRole('button', { name: 'Send Link' })).toBeEnabled();
  mocks.post.mockResolvedValue({ data: {} });
  await act(async () => submit());
  expect(screen.getByText('Check your inbox')).toBeInTheDocument();
});

it.each(['', 'invalid', '@example.com'])('does not submit invalid email: %s', email => {
  render(<ForgotPasswordModal isOpen onClose={vi.fn()} />);
  submit(email);
  expect(mocks.post).not.toHaveBeenCalled();
});

it('aborts on close and ignores a late result after reopening', async () => {
  let resolve!: (value: unknown) => void;
  mocks.post.mockReturnValue(new Promise(done => { resolve = done; }));
  const onClose = vi.fn();
  const { rerender } = render(<ForgotPasswordModal isOpen onClose={onClose} />);
  submit();
  const signal = mocks.post.mock.calls[0][2].signal as AbortSignal;
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  expect(signal.aborted).toBe(true);
  expect(onClose).toHaveBeenCalledOnce();
  rerender(<ForgotPasswordModal isOpen={false} onClose={onClose} />);
  rerender(<ForgotPasswordModal isOpen onClose={onClose} />);
  await act(async () => resolve({ data: {} }));
  expect(screen.queryByText('Check your inbox')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Email address')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Send Link' })).toBeEnabled();
});

it('aborts an in-flight request if the parent closes the dialog', () => {
  mocks.post.mockReturnValue(new Promise(() => {}));
  const { rerender } = render(<ForgotPasswordModal isOpen onClose={vi.fn()} />);
  submit();
  const signal = mocks.post.mock.calls[0][2].signal as AbortSignal;
  rerender(<ForgotPasswordModal isOpen={false} onClose={vi.fn()} />);
  expect(signal.aborted).toBe(true);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
