import { baseLayout, escapeHtml } from './baseLayout.js';

export function loginOtpEmailTemplate({ name, code }) {
  const safeName = escapeHtml(name || 'there');

  return {
    subject: 'Your Meow sign-in code',
    html: baseLayout({
      title: 'Your login code',
      body: `
        <p style="margin:0 0 12px">
          Hi ${safeName},
        </p>
        <p style="margin:0">
          Use this one-time password to securely sign in to your Meow account.
        </p>
      `,
      code,
      note: 'This code expires in 5 minutes. Never share your OTP with anyone.',
      secondaryNote: "If you didn't request this code, you can safely ignore this email.",
    }),
    text: `Your Meow sign-in code: ${code}\n\nThis code expires in 5 minutes. Do not share it with anyone. If you did not request it, ignore this email.`,
  };
}
