import { AppSettings } from "./db/settings";
import { scoreContent } from "./scoring/scorer";
import {
  bestEffortTitle,
  detectCity,
  extractNextdoorUrl,
  snippetFromText,
  stripHtml
} from "./parser/emailParser";

export type LeadCandidate = {
  source: "nextdoor_email";
  postUrl: string;
  title: string;
  snippet: string;
  rawSender: string;
  receivedAt: Date;
  city: string | null;
  category: "LANDSCAPING" | "INSTALL" | "UNKNOWN";
  score: number;
  rawBody?: string | null;
};

export type ParsedEmailInput = {
  subject: string;
  text: string;
  html: string;
  from: string;
  receivedAt: Date;
};

export const buildLeadCandidate = (
  parsed: ParsedEmailInput,
  settings: AppSettings
): LeadCandidate | null => {
  const htmlText = parsed.html ? stripHtml(parsed.html) : "";
  const combined = [parsed.subject, parsed.text, htmlText].join("\n").trim();
  const postUrl = extractNextdoorUrl(combined);
  if (!postUrl) {
    return null;
  }

  const title = bestEffortTitle(parsed.subject, parsed.text || htmlText);
  const snippet = snippetFromText(parsed.text || htmlText);
  const city = detectCity(combined, settings.cityList);
  if (!city) {
    return null;
  }

  const scoreResult = scoreContent(combined, settings.keywordConfig);

  return {
    source: "nextdoor_email",
    postUrl,
    title,
    snippet,
    rawSender: parsed.from,
    receivedAt: parsed.receivedAt,
    city,
    category: scoreResult.category,
    score: scoreResult.score,
    rawBody: settings.storeRawEmail ? combined : null
  };
};
