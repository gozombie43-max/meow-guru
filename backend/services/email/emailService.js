import { resend } from './resendClient.js';

const EMAIL_FROM = process.env.EMAIL_FROM?.trim();

if (!EMAIL_FROM) {
  throw new Error('EMAIL_FROM is not configured');
}

export async function sendEmail({ to, subject, html, text }) {
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
  });

  if (error) throw new Error(`Resend email failed: ${error.message}`);

  return data;
}
