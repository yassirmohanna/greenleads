import { google } from "googleapis";
import { EmailProvider, RawEmail } from "./provider";

export type GmailConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
  fromFilter?: string;
  label?: string;
  lastQueryAfter?: number | null;
};

export class GmailEmailProvider implements EmailProvider {
  private config: GmailConfig;
  private lastQueryAfter?: number | null;

  constructor(config: GmailConfig) {
    this.config = config;
    this.lastQueryAfter = config.lastQueryAfter ?? null;
  }

  getLastQueryAfter() {
    return this.lastQueryAfter;
  }

  async fetchNewMessages(): Promise<RawEmail[]> {
    const auth = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );
    auth.setCredentials({ refresh_token: this.config.refreshToken });

    const gmail = google.gmail({ version: "v1", auth });
    const after = this.lastQueryAfter ?? Math.floor(Date.now() / 1000) - 7 * 24 * 3600;

    const queryParts: string[] = [];
    if (this.config.fromFilter) {
      queryParts.push(`from:${this.config.fromFilter}`);
    }
    if (this.config.label) {
      queryParts.push(`label:"${this.config.label}"`);
    }
    queryParts.push(`after:${after}`);

    const list = await gmail.users.messages.list({
      userId: "me",
      q: queryParts.join(" ")
    });

    const messages: RawEmail[] = [];
    const items = list.data.messages ?? [];
    for (const item of items) {
      if (!item.id) {
        continue;
      }
      const message = await gmail.users.messages.get({
        userId: "me",
        id: item.id,
        format: "raw"
      });
      const raw = message.data.raw;
      if (raw) {
        const buffer = Buffer.from(raw, "base64");
        messages.push({ id: item.id, raw: buffer.toString("utf8") });
      }
    }

    this.lastQueryAfter = Math.floor(Date.now() / 1000);
    return messages;
  }
}
