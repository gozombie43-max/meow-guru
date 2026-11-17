import { baseLayout, escapeHtml } from './baseLayout.js';

export function verificationEmailTemplate({ name, verifyUrl }) {
  const safeName = escapeHtml(name || 'there');

  return {
    subject: 'Verify your Meow account',
    html: baseLayout({
      title: 'Verify your email',
      body: `
        <p style="margin:0 0 12px">
          Hi ${safeName},
        </p>
        <p style="margin:0">
          Verify your email address to activate your Meow account.
        </p>
      `,
      actionLabel: 'Verify email',
      actionUrl: verifyUrl,
      note: 'This verification link expires in 30 minutes.',
      secondaryNote: 'If you did not create a Meow account, you can safely ignore this email.',
    }),
    text: `Verify your Meow account: ${verifyUrl}`,
  };
}
