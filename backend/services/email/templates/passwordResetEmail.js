import { baseLayout } from './baseLayout.js';

export function passwordResetEmailTemplate({ resetUrl }) {
  return {
    subject: 'Reset your Meow password',
    html: baseLayout({
      title: 'Reset your password',
      body: `
        <p style="margin:0 0 12px">
          We received a request to reset your Meow password.
        </p>
        <p style="margin:0">
          Use the button below to choose a new password.
        </p>
      `,
      actionLabel: 'Reset password',
      actionUrl: resetUrl,
      note: 'This password reset link expires in 15 minutes.',
      secondaryNote: 'If you did not request this change, you can safely ignore this email.',
    }),
    text: `Reset your Meow password: ${resetUrl}`,
  };
}
