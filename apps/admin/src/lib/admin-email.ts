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

function layout(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f5f7fb;color:#091533;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:32px;background:#ffffff;border-radius:16px">
<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#075985">ConPaws Admin</p>
<h1 style="margin:0 0 20px;font-size:22px;line-height:30px">${escapeHtml(title)}</h1>
${body}
</div>
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
    subject: `Your ConPaws Admin code: ${formatted}`,
    text: [
      "Your ConPaws Admin sign-in code:",
      "",
      formatted,
      "",
      expiry,
      "",
      ignore,
    ].join("\n"),
    html: layout(
      "Your sign-in code",
      [
        `<p style="margin:0 0 20px;font-size:32px;line-height:40px;font-weight:700;letter-spacing:4px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">${formatted}</p>`,
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
    text: [intro, "", how, "", link, "", expiry].join("\n"),
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
