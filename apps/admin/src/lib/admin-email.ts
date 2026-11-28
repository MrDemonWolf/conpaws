import type { AdminBindings } from "./db";
import type { AdminRole } from "./sign-in";
import { formatSignInCode } from "./sign-in-crypto";

export interface AdminEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const paragraph = 'style="margin:0 0 16px;font-size:15px;line-height:24px"';

const senderNotice =
  "This sending address is not monitored. For help, email support@conpaws.com.";

function layout(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ConPaws Admin</title>
</head>
<body style="margin:0;background:#f5f7fb;color:#091533;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border:1px solid #dbe3ee;border-radius:16px">
<tr><td align="left" style="padding:28px">
<img src="https://admin.conpaws.com/pwa-icon-192.png" alt="" width="48" height="48" style="display:block;border:0;border-radius:12px;margin:0 0 12px">
<p style="margin:0 0 20px;font-size:14px;line-height:20px;font-weight:700;color:#075985">ConPaws Admin</p>
<h1 style="margin:0 0 16px;font-size:26px;line-height:32px">${escapeHtml(title)}</h1>
${body}
<p style="margin:24px 0 0;border-top:1px solid #dbe3ee;padding-top:16px;font-size:13px;line-height:20px;color:#475569">This sending address is not monitored. For help, email <a href="mailto:support@conpaws.com" style="color:#075985">support@conpaws.com</a>.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function signInCodeEmail(to: string, code: string): AdminEmail {
  const formatted = formatSignInCode(code);
  const expiry =
    "It expires in 10 minutes and only works in the browser where you asked for it.";
  const ignore =
    "Didn't ask for this? You can ignore this email. Nobody can sign in without the code.";
  return {
    to,
    subject: "Your ConPaws Admin sign-in code",
    text: [
      "Your ConPaws Admin sign-in code:",
      "",
      formatted,
      "",
      expiry,
      "",
      ignore,
      "",
      senderNotice,
    ].join("\n"),
    html: layout(
      "Your sign-in code",
      [
        `<p style="margin:0 0 16px;padding:12px 16px;border:1px solid #c8e6f6;border-radius:10px;background:#f0f9ff;font-size:28px;line-height:36px;font-weight:700;letter-spacing:2px;font-family:Menlo,Consolas,monospace">${escapeHtml(formatted)}</p>`,
        `<p ${paragraph}>${escapeHtml(expiry)}</p>`,
        `<p ${paragraph}>${escapeHtml(ignore)}</p>`,
      ].join("\n"),
    ),
  };
}

const roleLabels: Record<AdminRole, string> = {
  owner: "an owner",
  editor: "an editor",
};

export function inviteEmail(input: {
  to: string;
  role: AdminRole;
  invitedBy: string;
  signInUrl: string | null;
  expiresAt: number;
}): AdminEmail {
  const expires = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(input.expiresAt);
  const intro = `${input.invitedBy} invited you to ConPaws Admin as ${roleLabels[input.role]}.`;
  const how =
    "There is no password. Sign in with this email address and ConPaws sends you a one-time code.";
  const expiry = `The invite expires on ${expires} (UTC). If you weren't expecting it, you can ignore this email.`;
  const link = input.signInUrl
    ? `Sign in: ${input.signInUrl}`
    : "Open the ConPaws Admin sign-in page to accept.";
  return {
    to: input.to,
    subject: "You're invited to ConPaws Admin",
    text: [intro, "", how, "", link, "", expiry, "", senderNotice].join("\n"),
    html: layout(
      "You're invited",
      [
        `<p ${paragraph}>${escapeHtml(intro)}</p>`,
        `<p ${paragraph}>${escapeHtml(how)}</p>`,
        input.signInUrl
          ? `<p style="margin:0 0 20px"><a href="${escapeHtml(input.signInUrl)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#091533;color:#ffffff;font-weight:700;text-decoration:none">Sign in to ConPaws Admin</a></p>`
          : `<p ${paragraph}>${escapeHtml(link)}</p>`,
        `<p style="margin:0;font-size:13px;line-height:20px;color:#475569">${escapeHtml(expiry)}</p>`,
      ].join("\n"),
    ),
  };
}

/**
 * Sends through Cloudflare Email Service. Returns whether it was accepted.
 * Logs only the service's error code: the recipient and the message are
 * personal data, and a sign-in code is a credential.
 */
export async function sendAdminEmail(env: AdminBindings, message: AdminEmail) {
  const from = env.ADMIN_EMAIL_FROM?.trim();
  if (!env.ADMIN_EMAIL || !from) {
    console.error(
      "Admin email not sent: the email binding or sender address is missing.",
    );
    return false;
  }
  try {
    await env.ADMIN_EMAIL.send({
      from: { name: "ConPaws Admin", email: from },
      to: message.to,
      replyTo: "support@conpaws.com",
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return true;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "unknown";
    console.error(`Admin email not sent (${code}).`);
    return false;
  }
}
