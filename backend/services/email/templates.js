export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]
  );
}

function emailShell({
  title,
  body,
  actionLabel,
  actionUrl,
  code,
  footer,
}) {
  const safeTitle =
    escapeHtml(title);

  const safeActionLabel =
    escapeHtml(actionLabel);

  const safeActionUrl =
    escapeHtml(actionUrl);

  const safeFooter =
    escapeHtml(footer);

  return `
<!doctype html>
<html>
  <body style="
    margin:0;
    padding:0;
    background:#f5f5f7;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
    color:#111827;
  ">
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      style="
        width:100%;
        background:#f5f5f7;
        padding:32px 16px;
      "
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="
              max-width:520px;
              background:#ffffff;
              border-radius:20px;
              padding:36px 32px;
            "
          >
            <tr>
              <td>
                <div style="
                  font-size:20px;
                  font-weight:700;
                  margin-bottom:28px;
                ">
                  Meow
                </div>

                <h1 style="
                  margin:0 0 16px;
                  font-size:26px;
                  line-height:1.25;
                  font-weight:700;
                ">
                  ${safeTitle}
                </h1>

                <div style="
                  font-size:15px;
                  line-height:1.7;
                  color:#4b5563;
                ">
                  ${body}
                </div>

                <div style="
                  margin:28px 0;
                ">
                  ${code ? `<div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#111827">${escapeHtml(code)}</div>` : `<a
                    href="${safeActionUrl}"
                    style="
                      display:inline-block;
                      background:#111111;
                      color:#ffffff;
                      text-decoration:none;
                      font-size:15px;
                      font-weight:600;
                      padding:13px 20px;
                      border-radius:12px;
                    "
                  >
                    ${safeActionLabel}
                  </a>`}
                </div>

                <p style="
                  margin:0;
                  font-size:13px;
                  line-height:1.6;
                  color:#9ca3af;
                ">
                  ${safeFooter}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

export function verificationEmailTemplate({
  name,
  verifyUrl,
}) {
  const safeName =
    escapeHtml(name || 'there');

  return {
    subject:
      'Verify your Meow account',

    html: emailShell({
      title:
        'Verify your email',

      body: `
        <p style="margin:0 0 12px">
          Hi ${safeName},
        </p>

        <p style="margin:0">
          Verify your email address to activate your Meow account.
        </p>
      `,

      actionLabel:
        'Verify email',

      actionUrl:
        verifyUrl,

      footer:
        'This verification link expires in 30 minutes.',
    }),

    text:
      `Verify your Meow account: ${verifyUrl}`,
  };
}

export function passwordResetEmailTemplate({
  resetUrl,
}) {
  return {
    subject:
      'Reset your Meow password',

    html: emailShell({
      title:
        'Reset your password',

      body: `
        <p style="margin:0 0 12px">
          We received a request to reset your Meow password.
        </p>

        <p style="margin:0">
          If you did not request this change, you can safely ignore this email.
        </p>
      `,

      actionLabel:
        'Reset password',

      actionUrl:
        resetUrl,

      footer:
        'This password reset link expires in 15 minutes.',
    }),

    text:
      `Reset your Meow password: ${resetUrl}`,
  };
}

export function loginOtpEmailTemplate({ code }) {
  return {
    subject: 'Your Meow sign-in code',
    html: emailShell({
      title: 'Your sign-in code',
      body: '<p style="margin:0">Enter this code in Meow to sign in or create your account. Do not share it with anyone.</p>',
      code,
      footer: 'This code expires in 5 minutes. If you did not request it, you can ignore this email.',
    }),
    text: `Your Meow sign-in code: ${code}\n\nThis code expires in 5 minutes. Do not share it with anyone. If you did not request it, ignore this email.`,
  };
}
