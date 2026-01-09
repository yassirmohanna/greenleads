export type RawEmail = {
  id: string;
  raw: string;
};

export interface EmailProvider {
  fetchNewMessages(): Promise<RawEmail[]>;
}
