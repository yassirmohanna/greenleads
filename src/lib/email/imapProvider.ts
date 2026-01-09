import { ImapFlow } from "imapflow";
import { EmailProvider, RawEmail } from "./provider";

export type ImapConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  folder: string;
  fromFilter?: string;
  lastUid?: number | null;import { ImapFlow } from "imapflow";
import { EmailProvider, RawEmail } from "./provider";

export type ImapConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  folder: string;
  fromFilter?: string;
  lastUid?: number | null;
};

export class ImapEmailProvider implements EmailProvider {
  private config: ImapConfig;
  private lastSeenUid?: number | null;

  constructor(config: ImapConfig) {
    this.config = config;
    this.lastSeenUid = config.lastUid ?? null;
  }

  getLastSeenUid() {
    return this.lastSeenUid;
  }

  async fetchNewMessages(): Promise<RawEmail[]> {
    const client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.password
      }
    });

    await client.connect();
    const lock = await client.getMailboxLock(this.config.folder);
    try {
      const query: Record<string, unknown> = {};
      if (this.config.fromFilter) {
        query.from = this.config.fromFilter;
      }
      if (this.lastSeenUid) {
        query.uid = `${this.lastSeenUid + 1}:*`;
      }

      const uids = await client.search(query);
      const messages: RawEmail[] = [];

      if (!uids || uids.length === 0) {
        return messages;
      }

      for (const uid of uids) {
        const message = (await client.fetchOne(uid, { source: true })) as
          | { source?: Buffer | string }
          | null
          | undefined;
        if (message?.source) {
          messages.push({ id: `${uid}`, raw: message.source.toString() });
          if (!this.lastSeenUid || uid > this.lastSeenUid) {
            this.lastSeenUid = uid;
          }
        }
      }

      return messages;
    } finally {
      lock.release();
      await client.logout();
    }
  }
}

};

export class ImapEmailProvider implements EmailProvider {
  private config: ImapConfig;
  private lastSeenUid?: number | null;

  constructor(config: ImapConfig) {
    this.config = config;
    this.lastSeenUid = config.lastUid ?? null;
  }

  getLastSeenUid() {
    return this.lastSeenUid;
  }

  async fetchNewMessages(): Promise<RawEmail[]> {
    const client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.password
      }
    });

    await client.connect();
    const lock = await client.getMailboxLock(this.config.folder);
    try {
      const query: Record<string, unknown> = {};
      if (this.config.fromFilter) {
        query.from = this.config.fromFilter;
      }
      if (this.lastSeenUid) {
        query.uid = `${this.lastSeenUid + 1}:*`;
      }

      const uids = await client.search(query);
      const messages: RawEmail[] = [];

      if (!uids || uids.length === 0) {
        return messages;
      }

      for (const uid of uids) {
        const message = await client.fetchOne(uid, { source: true });
        if (message && message !== false && message.source) {
          messages.push({ id: `${uid}`, raw: message.source.toString() });
          if (!this.lastSeenUid || uid > this.lastSeenUid) {
            this.lastSeenUid = uid;
          }
        }
      }

      return messages;
    } finally {
      lock.release();
      await client.logout();
    }
  }
}

