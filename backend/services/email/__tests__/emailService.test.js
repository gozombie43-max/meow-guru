import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ send: vi.fn(), keys: [] }));
vi.mock('resend', () => ({ Resend: class {
  constructor(key) { state.keys.push(key); this.emails = { send: state.send }; }
} }));

beforeEach(() => {
  vi.resetModules(); state.send.mockReset(); state.keys.length = 0;
  vi.stubEnv('RESEND_API_KEY', 're_unit_test_only'); vi.stubEnv('EMAIL_FROM', '');
});
afterEach(() => vi.unstubAllEnvs());

it('sends through the configured client and returns provider data', async () => {
  state.send.mockResolvedValue({ data: { id: 'test-id' }, error: null });
  const { sendEmail } = await import('../emailService.js');
  await expect(sendEmail({ to: 'delivered@resend.dev', subject: 'Test', html: '<b>Test</b>' })).resolves.toEqual({ id: 'test-id' });
  expect(state.keys).toEqual(['re_unit_test_only']);
  expect(state.send).toHaveBeenCalledWith({ from: 'Meow <onboarding@resend.dev>', to: 'delivered@resend.dev', subject: 'Test', html: '<b>Test</b>' });
});

it('preserves the configured sender and plain-text alternative', async () => {
  vi.stubEnv('EMAIL_FROM', 'Meow <sender@example.test>');
  state.send.mockResolvedValue({ data: { id: 'text-id' }, error: null });
  const { sendEmail } = await import('../emailService.js');
  await sendEmail({ to: 'delivered@resend.dev', subject: 'Test', html: '<b>Test</b>', text: 'Test' });
  expect(state.send).toHaveBeenCalledWith(expect.objectContaining({ from: 'Meow <sender@example.test>', text: 'Test' }));
});

it('rejects provider errors instead of reporting successful delivery', async () => {
  state.send.mockResolvedValue({ data: null, error: { message: 'Provider rejected the sender' } });
  const { sendEmail } = await import('../emailService.js');
  await expect(sendEmail({ to: 'delivered@resend.dev', subject: 'Test', html: 'Test' })).rejects.toThrow('Resend email failed: Provider rejected the sender');
});

it('propagates transport failures', async () => {
  state.send.mockRejectedValue(new Error('Network unavailable'));
  const { sendEmail } = await import('../emailService.js');
  await expect(sendEmail({ to: 'delivered@resend.dev', subject: 'Test', html: 'Test' })).rejects.toThrow('Network unavailable');
});

it('fails before sending when the backend key is missing', async () => {
  vi.stubEnv('RESEND_API_KEY', '');
  await expect(import('../emailService.js')).rejects.toThrow('RESEND_API_KEY is not configured');
  expect(state.send).not.toHaveBeenCalled();
});
