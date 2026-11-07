import nodemailer from "nodemailer";
import { logger } from "./logger";

export type Mail = { to: string; subject: string; text: string };
type Transport = (mail: Mail) => Promise<void>;

function smtpTransport(): Transport | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const client = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass: process.env.SMTP_PASS } : undefined,
  });
  const from = process.env.MAIL_FROM ?? "HelpDeskAI <no-reply@helpdesk.local>";
  return async (mail) => {
    await client.sendMail({ from, ...mail });
  };
}

let transport: Transport | null = smtpTransport();

/** Lets tests capture outgoing mail instead of sending it. */
export function setMailTransport(next: Transport | null): void {
  transport = next;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (!transport) {
    logger.warn("SMTP_HOST is not set; email was not sent.");
    return;
  }
  await transport(mail);
}