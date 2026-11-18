/**
 * Escape untrusted values before interpolating into HTML email content or attributes.
 */
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

/**
 * Shared Meow transactional email shell with consistent typography, spacing, and footer.
 */
export function baseLayout({
  title,
  body,
  actionLabel,
  actionUrl,
  code,
  note,
  secondaryNote,
}) {
  const safeTitle = escapeHtml(title);

  let highlightBlock = '';
  if (code) {
    highlightBlock = `
      <div style="background:#f3f4f6;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
        <p style="margin:0;font-size:12px;font-weight:600;color:#6b7280;letter-spacing:1px;text-transform:uppercase;">
          YOUR VERIFICATION CODE
        </p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;margin:12px 0 0;">
          ${escapeHtml(code)}
        </div>
      </div>`;
  } else if (actionUrl && actionLabel) {
    highlightBlock = `
      <div style="margin:28px 0;">
        <a
          href="${escapeHtml(actionUrl)}"
          style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 20px;border-radius:12px;"
        >
          ${escapeHtml(actionLabel)}
        </a>
      </div>`;
  }

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f3f4f6;">
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px;"
          >
            <tr>
              <td>
                <div style="font-size:23px;font-weight:700;margin:0 0 28px;color:#111827;">
                  Meow
                </div>

                <h1 style="margin:0 0 16px;font-size:25px;line-height:1.25;font-weight:700;color:#111827;">
                  ${safeTitle}
                </h1>

                <div style="font-size:15px;line-height:1.6;color:#4b5563;">
                  ${body}
                </div>

                ${highlightBlock}

                ${note ? `<p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563;">${escapeHtml(note)}</p>` : ''}

                <hr style="border:0;border-top:1px solid #e5e7eb;margin:28px 0;">

                ${secondaryNote ? `<p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:#9ca3af;">${escapeHtml(secondaryNote)}</p>` : ''}

                <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;text-align:center;">
                  © 2026 Meow · SSC &amp; RRB Preparation
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
