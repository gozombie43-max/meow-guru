import { expect, type APIRequestContext } from '@playwright/test';

export async function verifyFixtureEmail(request: APIRequestContext, email: string) {
  const message = await request.get('http://127.0.0.1:3111/__fixture/verification-email', { params: { email } });
  expect(message.ok(), 'Read the email captured by the loopback-only fixture').toBeTruthy();
  const { text } = await message.json();
  const token = new URL(text.slice('Verify your Meow account: '.length)).searchParams.get('token');
  const verification = await request.post('http://127.0.0.1:3111/auth/verify-email', { data: { token } });
  expect(verification.ok(), 'Verify the isolated account before password login').toBeTruthy();
}
