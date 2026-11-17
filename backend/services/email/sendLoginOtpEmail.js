import { loginOtpEmailTemplate } from './templates/loginOtpEmail.js';

export async function sendLoginOtpEmail(email, code, name) {
  const { sendEmail } = await import('./emailService.js');
  return sendEmail({ to: email, ...loginOtpEmailTemplate({ name, code }) });
}
