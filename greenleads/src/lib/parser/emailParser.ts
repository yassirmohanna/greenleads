import { simpleParser } from "mailparser";

export type ParsedEmail = {
  subject: string;
  text: string;
  html: string;
  from: string;
  receivedAt: Date;
};

export const parseRawEmail = async (raw: string): Promise<ParsedEmail> => {
  const parsed = await simpleParser(raw);
  return {
    subject: parsed.subject ?? "",
    text: parsed.text ?? "",
    html: typeof parsed.html === "string" ? parsed.html : "",
    from: parsed.from?.text ?? "",
    receivedAt: parsed.date ?? new Date()
  };
};

export const stripHtml = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const extractUrls = (text: string): string[] => {
  const urls = new Set<string>();
  const regex = /(https?:\/\/[^\s"'<>]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    const cleaned = match[1].replace(/[).,;]+$/, "");
    urls.add(cleaned);
  }
  return Array.from(urls);
};

export const bestEffortTitle = (subject: string, text: string): string => {
  const cleanedSubject = subject.trim();
  if (cleanedSubject) {
    return cleanedSubject;
  }
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean);
  return firstLine?.slice(0, 120) ?? "(no subject)";
};

export const snippetFromText = (text: string, maxLength = 220): string => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > maxLength
    ? `${cleaned.slice(0, maxLength - 1)}…`
    : cleaned;
};

export const detectCity = (text: string, cities: string[]): string | null => {
  const lower = text.toLowerCase();
  for (const city of cities) {
    const needle = city.toLowerCase();
    if (needle && lower.includes(needle)) {
      return city;
    }
  }
  return null;
};

export const extractNextdoorUrl = (text: string): string | null => {
  const urls = extractUrls(text);
  const nextdoor = urls.find((url) => url.includes("nextdoor.com"));
  return nextdoor ?? null;
};
