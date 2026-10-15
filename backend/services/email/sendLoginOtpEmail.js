import { loginOtpEmailTemplate } from './templates.js';

export async function sendLoginOtpEmail(email, code) {
  const { sendEmail } = await import('./emailService.js');
  return sendEmail({ to: email, ...loginOtpEmailTemplate({ code }) });
}
