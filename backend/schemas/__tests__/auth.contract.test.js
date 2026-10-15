import { expect, it } from 'vitest';
import { verifyEmailSchema, resendVerificationSchema, forgotPasswordSchema, resetPasswordSchema } from '@meow/contracts/auth';
import { requestEmailOtpSchema, verifyEmailOtpSchema } from '@meow/contracts/auth';

it('normalizes OTP email, strips client privileges, and keeps codes as six-digit strings', () => {
  expect(requestEmailOtpSchema.parse({ email: ' Learner@Example.test ', role: 'admin' })).toEqual({ email: 'learner@example.test' });
  expect(verifyEmailOtpSchema.parse({ email: 'Learner@Example.test', challengeId: 'a'.repeat(64), code: ' 012345 ', role: 'admin' }))
    .toEqual({ email: 'learner@example.test', challengeId: 'a'.repeat(64), code: '012345' });
});

it.each([123456, '', '12345', '1234567', 'abcdef', { $gt: '' }])('rejects malformed OTP code %j', code => {
  expect(verifyEmailOtpSchema.safeParse({ email: 'a@example.test', challengeId: 'a'.repeat(64), code }).success).toBe(false);
});

it.each([verifyEmailSchema, resetPasswordSchema])('trims token whitespace and strips unknown fields', schema => {
  const parsed = schema.parse({ token: ' secret-token ', password: 'ValidPassword123!', role: 'admin', id: 'forged' });
  expect(parsed.token).toBe('secret-token');
  expect(parsed).not.toHaveProperty('role');
  expect(parsed).not.toHaveProperty('id');
});

it.each([undefined, null, 123, {}, '', '   ', 'a'.repeat(257)])('rejects malformed tokens: %j', token => {
  expect(verifyEmailSchema.safeParse({ token }).success).toBe(false);
  expect(resetPasswordSchema.safeParse({ token, password: 'password' }).success).toBe(false);
});

it.each([resendVerificationSchema, forgotPasswordSchema])('normalizes email and strips extra body fields', schema => {
  expect(schema.parse({ email: ' Alice@Example.com ', role: 'admin' })).toEqual({ email: 'alice@example.com' });
});

it.each([undefined, null, 123, {}, '', 'bad', '@example.com', 'a'.repeat(243) + '@example.com'])('rejects malformed or oversized recovery email: %j', email => {
  expect(resendVerificationSchema.safeParse({ email }).success).toBe(false);
  expect(forgotPasswordSchema.safeParse({ email }).success).toBe(false);
});

it.each([undefined, null, 123, '', 'short', 'a'.repeat(129), 'a'.repeat(73), '😀'.repeat(19)])('rejects invalid reset passwords including bcrypt truncation: %j', password => {
  expect(resetPasswordSchema.safeParse({ token: 'token', password }).success).toBe(false);
});

it.each(['abcdef', 'a'.repeat(72), '😀'.repeat(18), ' with spaces '])('preserves supported passwords unchanged', password => {
  expect(resetPasswordSchema.parse({ token: 'token', password }).password).toBe(password);
});
