import { expect, it } from 'vitest';
import { escapeHtml, passwordResetEmailTemplate, verificationEmailTemplate, loginOtpEmailTemplate } from '../templates.js';

it('renders the OTP as escaped text with expiry and no action link', () => {
  const email = loginOtpEmailTemplate({ code: '012345' });
  expect(email.subject).toBe('Your Meow sign-in code');
  expect(email.text).toContain('code: 012345');
  expect(email.html).toContain('012345');
  expect(email.html).toContain('expires in 5 minutes');
  expect(email.html).not.toContain('href=');
  expect(loginOtpEmailTemplate({ code: '<script>' }).html).toContain('&lt;script&gt;');
});

it('escapes HTML text and attribute delimiters', () => {
  expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
});

it('escapes the verification greeting and URL while preserving the plain-text link', () => {
  const name = '<img src=x onerror="alert(1)">';
  const verifyUrl = 'https://example.test/verify-email?token=test&next="<unsafe>\'';
  const email = verificationEmailTemplate({ name, verifyUrl });
  expect(email.subject).toBe('Verify your Meow account');
  expect(email.html).toContain(`Hi ${escapeHtml(name)},`);
  expect(email.html).not.toContain(name);
  expect(email.html).toContain(`href="${escapeHtml(verifyUrl)}"`);
  expect(email.html).toContain('This verification link expires in 30 minutes.');
  expect(email.text).toBe(`Verify your Meow account: ${verifyUrl}`);
});

it('uses a friendly fallback for an absent name', () => {
  expect(verificationEmailTemplate({ verifyUrl: 'https://example.test' }).html).toContain('Hi there,');
});

it('escapes the reset link and includes expiry and unsolicited-request guidance', () => {
  const resetUrl = 'https://example.test/reset-password?token=test&next="<unsafe>\'';
  const email = passwordResetEmailTemplate({ resetUrl });
  expect(email.subject).toBe('Reset your Meow password');
  expect(email.html).toContain(`href="${escapeHtml(resetUrl)}"`);
  expect(email.html).not.toContain(`href="${resetUrl}"`);
  expect(email.html).toContain('This password reset link expires in 15 minutes.');
  expect(email.html).toContain('you can safely ignore this email');
  expect(email.text).toBe(`Reset your Meow password: ${resetUrl}`);
});
