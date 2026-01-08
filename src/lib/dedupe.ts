export const isDuplicateUrl = (url: string, existing: Set<string>) => {
  const normalized = url.trim().toLowerCase();
  return existing.has(normalized);
};

export const addUrl = (url: string, existing: Set<string>) => {
  existing.add(url.trim().toLowerCase());
};
