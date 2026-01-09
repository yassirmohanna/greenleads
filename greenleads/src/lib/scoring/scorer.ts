import { KeywordConfig } from "../db/settings";

export type ScoreResult = {
  score: number;
  category: "LANDSCAPING" | "INSTALL" | "UNKNOWN";
  matched: {
    landscaping: string[];
    install: string[];
    negative: string[];
  };
};

const normalize = (value: string) => value.toLowerCase();

const countMatches = (text: string, keywords: string[]) => {
  const matches: string[] = [];
  const lower = normalize(text);
  for (const keyword of keywords) {
    const needle = normalize(keyword);
    if (needle && lower.includes(needle)) {
      matches.push(keyword);
    }
  }
  return matches;
};

export const scoreContent = (text: string, config: KeywordConfig): ScoreResult => {
  const landscapingStrong = countMatches(text, config.landscaping.strong);
  const landscapingWeak = countMatches(text, config.landscaping.weak);
  const installStrong = countMatches(text, config.install.strong);
  const installWeak = countMatches(text, config.install.weak);
  const negative = countMatches(text, config.negative);

  const score =
    landscapingStrong.length * 2 +
    landscapingWeak.length +
    installStrong.length * 2 +
    installWeak.length -
    negative.length * 2;

  let category: ScoreResult["category"] = "UNKNOWN";
  const landscapingScore = landscapingStrong.length * 2 + landscapingWeak.length;
  const installScore = installStrong.length * 2 + installWeak.length;
  if (landscapingScore > installScore && landscapingScore > 0) {
    category = "LANDSCAPING";
  } else if (installScore > landscapingScore && installScore > 0) {
    category = "INSTALL";
  }

  return {
    score,
    category,
    matched: {
      landscaping: [...landscapingStrong, ...landscapingWeak],
      install: [...installStrong, ...installWeak],
      negative
    }
  };
};
