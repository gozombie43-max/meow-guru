import { passwordResetEmailTemplate } from './templates.js';

export async function sendPasswordResetEmail(user, token, frontendUrl) {
  const resetUrl = new URL('/reset-password', frontendUrl);
  resetUrl.searchParams.set('token', token);
  // Keep optional email configuration out of auth-router startup.
  const { sendEmail } = await import('./emailService.js');
  return sendEmail({
    to: user.email,
    ...passwordResetEmailTemplate({ resetUrl: resetUrl.href }),
  });
}
