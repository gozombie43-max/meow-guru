export async function sendVerificationEmail(user, token, frontendUrl) {
  const verifyUrl = new URL('/verify-email', frontendUrl);
  verifyUrl.searchParams.set('token', token);
  // Keep email configuration failures inside the caller's guarded send.
  const { sendEmail } = await import('./emailService.js');
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  return sendEmail({
    to: user.email,
    subject: 'Verify your Meow account',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px">
        <h2>Verify your email</h2>
        <p>Hi ${escapeHtml(user.name || 'there')},</p>
        <p>Verify your email address to activate your Meow account.</p>
        <a href="${escapeHtml(verifyUrl.href)}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">Verify email</a>
        <p style="margin-top:24px;font-size:13px;color:#666">This link expires in 30 minutes.</p>
      </div>
    `,
    text: `Verify your Meow account: ${verifyUrl.href}`,
  });
}
