import { EmailProvider } from "./provider";
import { GmailEmailProvider } from "./gmailProvider";
import { ImapEmailProvider } from "./imapProvider";

export const createEmailProvider = (options: {
  lastImapUid?: number | null;
  lastGmailQueryAfter?: number | null;
}): EmailProvider => {
  const provider = process.env.EMAIL_PROVIDER ?? "imap";
  if (provider === "gmail") {
    if (
      !process.env.GMAIL_CLIENT_ID ||
      !process.env.GMAIL_CLIENT_SECRET ||
      !process.env.GMAIL_REDIRECT_URI ||
      !process.env.GMAIL_REFRESH_TOKEN
    ) {
      throw new Error("Missing Gmail OAuth environment variables");
    }
    return new GmailEmailProvider({
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      redirectUri: process.env.GMAIL_REDIRECT_URI,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      fromFilter: process.env.GMAIL_FROM_FILTER ?? "nextdoor",
      label: process.env.GMAIL_LABEL,
      lastQueryAfter: options.lastGmailQueryAfter
    });
  }

  if (
    !process.env.IMAP_HOST ||
    !process.env.IMAP_PORT ||
    !process.env.IMAP_USER ||
    !process.env.IMAP_PASSWORD
  ) {
    throw new Error("Missing IMAP environment variables");
  }

  return new ImapEmailProvider({
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT),
    secure: process.env.IMAP_SECURE !== "false",
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASSWORD,
    folder: process.env.IMAP_FOLDER ?? "INBOX",
    fromFilter: process.env.IMAP_FROM_FILTER ?? "nextdoor",
    lastUid: options.lastImapUid
  });
};
