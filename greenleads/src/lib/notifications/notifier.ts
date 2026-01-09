import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";

export type NotificationPayload = {
  title: string;
  snippet: string;
  city?: string | null;
  postUrl: string;
};

export const sendSmsAlerts = async (
  payload: NotificationPayload,
  toNumbers: string[]
) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber || toNumbers.length === 0) {
    return;
  }

  const client = twilio(accountSid, authToken);
  const body = `New Nextdoor lead${payload.city ? ` (${payload.city})` : ""}: ${payload.title}\n${payload.snippet}\n${payload.postUrl}`;

  await Promise.all(
    toNumbers.map((to) =>
      client.messages.create({
        to,
        from: fromNumber,
        body
      })
    )
  );
};

export const sendEmailAlerts = async (
  payload: NotificationPayload,
  toEmails: string[]
) => {
  if (toEmails.length === 0) {
    return;
  }

  const subject = `Nextdoor lead${payload.city ? ` (${payload.city})` : ""}: ${payload.title}`;
  const text = `${payload.title}\n${payload.snippet}\n${payload.city ? `City: ${payload.city}\n` : ""}${payload.postUrl}`;

  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send({
      to: toEmails,
      from: process.env.EMAIL_FROM ?? "leads@example.com",
      subject,
      text
    });
    return;
  }

  if (!process.env.SMTP_HOST) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      : undefined
  });

  await transporter.sendMail({
    to: toEmails.join(","),
    from: process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "leads@example.com",
    subject,
    text
  });
};
