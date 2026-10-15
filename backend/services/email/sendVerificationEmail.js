import { verificationEmailTemplate } from './templates.js';

export async function sendVerificationEmail(user, token, frontendUrl) {
  const verifyUrl = new URL('/verify-email', frontendUrl);
  verifyUrl.searchParams.set('token', token);
  // Keep email configuration failures inside the caller's guarded send.
  const { sendEmail } = await import('./emailService.js');
  return sendEmail({
    to: user.email,
    ...verificationEmailTemplate({ name: user.name, verifyUrl: verifyUrl.href }),
  });
}
