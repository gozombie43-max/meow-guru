import { resend } from './resendClient.js';

const FROM_EMAIL = process.env.EMAIL_FROM?.trim() || 'Meow <onboarding@resend.dev>';

export async function sendEmail({ to, subject, html, text }) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
  });

  if (error) throw new Error(`Resend email failed: ${error.message}`);

  return data;
}
