import { baseLayout, escapeHtml } from './baseLayout.js';

export function welcomeEmailTemplate({ name, appUrl } = {}) {
  const safeName = escapeHtml(name || 'there');

  return {
    subject: 'Welcome to Meow',
    html: baseLayout({
      title: 'Welcome to Meow',
      body: `
        <p style="margin:0 0 12px">
          Hi ${safeName},
        </p>
        <p style="margin:0">
          Your Meow account is active. You are ready to start practicing for SSC &amp; RRB exams.
        </p>
      `,
      ...(appUrl ? { actionLabel: 'Start practicing', actionUrl: appUrl } : {}),
      note: 'Consistent daily practice builds speed and accuracy.',
    }),
    text: appUrl
      ? `Welcome to Meow, ${name || 'there'}! Start practicing: ${appUrl}`
      : `Welcome to Meow, ${name || 'there'}! Your account is active.`,
  };
}
