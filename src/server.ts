import "dotenv/config";
import crypto from "crypto";
import path from "path";
import express from "express";
import cookieParser from "cookie-parser";
import { prisma } from "./lib/db/client";
import { getSettings, updateSettings, KeywordConfig } from "./lib/db/settings";
import { requireAuth, signToken, verifyPassword, hashPassword } from "./lib/auth/auth";
import { parseRawEmail } from "./lib/parser/emailParser";
import { buildLeadCandidate } from "./lib/leadProcessor";
import { scoreContent } from "./lib/scoring/scorer";

const app = express();

const allowedStatuses = ["NEW", "CONTACTED", "WON", "LOST", "IGNORED"];
const allowedCategories = ["LANDSCAPING", "INSTALL", "UNKNOWN"];
const ownerEmail = (process.env.OWNER_EMAIL ?? "yassirmohanna@gmail.com").toLowerCase();

app.set("views", path.join(process.cwd(), "src", "views"));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/public", express.static(path.join(process.cwd(), "src", "public")));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/login", (_req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.render("login", { error: "Invalid credentials" });
  }

  if (!user.active) {
    return res.render("login", { error: "Account is inactive" });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.render("login", { error: "Invalid credentials" });
  }

  const token = signToken({ userId: user.id, email: user.email });
  res.cookie("session", token, { httpOnly: true, sameSite: "lax" });
  return res.redirect("/leads");
});

app.get("/signup", async (req, res) => {
  const token = String(req.query.token ?? "");
  const hasUsers = (await prisma.user.count()) > 0;
  if (hasUsers && !token) {
    return res.render("signup", { error: "Invite link required.", token: "" });
  }
  res.render("signup", { error: null, token });
});

app.post("/signup", async (req, res) => {
  const { email, password, token } = req.body;
  if (!email || !password) {
    return res.render("signup", { error: "Email and password are required", token: token ?? "" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.render("signup", { error: "Email already registered", token: token ?? "" });
  }

  const totalUsers = await prisma.user.count();
  const isOwnerSignup = totalUsers === 0 && email.toLowerCase() === ownerEmail;
  let invite = null;

  if (!isOwnerSignup) {
    if (!token) {
      return res.render("signup", { error: "Invite link required.", token: "" });
    }

    invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.revokedAt || invite.usedAt) {
      return res.render("signup", { error: "Invite link is invalid.", token });
    }
    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
      return res.render("signup", { error: "Invite email mismatch.", token });
    }
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: isOwnerSignup ? "OWNER" : "USER",
      active: true
    }
  });

  if (invite) {
    await prisma.invite.update({
      where: { token: invite.token },
      data: { usedAt: new Date(), usedById: user.id }
    });
  }

  const tokenValue = signToken({ userId: user.id, email: user.email });
  res.cookie("session", tokenValue, { httpOnly: true, sameSite: "lax" });
  return res.redirect("/leads");
});

app.post("/logout", (_req, res) => {
  res.clearCookie("session");
  res.redirect("/login");
});


app.use(requireAuth);

app.use(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: res.locals.user.userId } });
  if (!user || !user.active) {
    res.clearCookie("session");
    return res.redirect("/login");
  }
  res.locals.currentUser = user;
  return next();
});

const requireOwner = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = res.locals.currentUser;
  if (!user || user.role !== "OWNER") {
    return res.status(403).send("Forbidden");
  }
  return next();
};

app.get("/", (_req, res) => res.redirect("/leads"));

app.get("/leads", async (req, res) => {
  const { status, city, category, sort } = req.query;
  const statusValue = allowedStatuses.includes(String(status))
    ? String(status)
    : undefined;
  const categoryValue = allowedCategories.includes(String(category))
    ? String(category)
    : undefined;

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const highlightText = (text: string, keywords: string[]) => {
    if (!text) {
      return "";
    }
    const unique = Array.from(
      new Set(
        keywords
          .map((keyword) => keyword.trim())
          .filter(Boolean)
          .sort((a, b) => b.length - a.length)
      )
    );
    let marked = text;
    for (const keyword of unique) {
      const pattern = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      marked = marked.replace(new RegExp(`(${pattern})`, "gi"), "__H_START__$1__H_END__");
    }
    const escaped = escapeHtml(marked);
    return escaped
      .replace(/__H_START__/g, "<mark>")
      .replace(/__H_END__/g, "</mark>");
  };

  const orderBy =
    sort === "score"
      ? { score: "desc" as const }
      : sort === "city"
      ? { city: "asc" as const }
      : { createdAt: "desc" as const };

  const leads = await prisma.lead.findMany({
    where: {
      status: statusValue,
      city: city ? String(city) : undefined,
      category: categoryValue
    },
    orderBy
  });

  const settings = await getSettings();
  const highlightKeywords = [
    ...settings.keywordConfig.landscaping.strong,
    ...settings.keywordConfig.landscaping.weak,
    ...settings.keywordConfig.install.strong,
    ...settings.keywordConfig.install.weak
  ];
  const leadsWithHighlights = leads.map((lead) => {
    const matched = scoreContent(
      `${lead.title} ${lead.snippet}`,
      settings.keywordConfig
    ).matched;
    return {
      ...lead,
      highlightedTitle: highlightText(lead.title, highlightKeywords),
      highlightedSnippet: highlightText(lead.snippet, highlightKeywords),
      matchedKeywords: Array.from(
        new Set([...matched.landscaping, ...matched.install])
      ).slice(0, 8)
    };
  });
  res.render("leads", {
    leads: leadsWithHighlights,
    filters: { status: statusValue, city, category: categoryValue, sort },
    settings
  });
});

app.get("/leads/:id", async (req, res) => {
  const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
  if (!lead) {
    return res.status(404).send("Not found");
  }
  const settings = await getSettings();
  const highlightKeywords = [
    ...settings.keywordConfig.landscaping.strong,
    ...settings.keywordConfig.landscaping.weak,
    ...settings.keywordConfig.install.strong,
    ...settings.keywordConfig.install.weak
  ];
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const highlightText = (text: string, keywords: string[]) => {
    if (!text) {
      return "";
    }
    const unique = Array.from(
      new Set(
        keywords
          .map((keyword) => keyword.trim())
          .filter(Boolean)
          .sort((a, b) => b.length - a.length)
      )
    );
    let marked = text;
    for (const keyword of unique) {
      const pattern = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      marked = marked.replace(new RegExp(`(${pattern})`, "gi"), "__H_START__$1__H_END__");
    }
    const escaped = escapeHtml(marked);
    return escaped
      .replace(/__H_START__/g, "<mark>")
      .replace(/__H_END__/g, "</mark>");
  };
  const matched = scoreContent(
    `${lead.title} ${lead.snippet}`,
    settings.keywordConfig
  ).matched;
  res.render("lead-detail", {
    lead: {
      ...lead,
      highlightedTitle: highlightText(lead.title, highlightKeywords),
      highlightedSnippet: highlightText(lead.snippet, highlightKeywords),
      matchedKeywords: Array.from(
        new Set([...matched.landscaping, ...matched.install])
      ).slice(0, 12)
    }
  });
});

app.post("/leads/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!allowedStatuses.includes(status)) {
    return res.redirect(`/leads/${req.params.id}`);
  }
  await prisma.lead.update({
    where: { id: req.params.id },
    data: { status }
  });
  res.redirect(`/leads/${req.params.id}`);
});

app.get("/admin/invites", requireOwner, async (_req, res) => {
  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: "desc" }
  });
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  res.render("admin-invites", {
    invites,
    users,
    ownerEmail,
    baseUrl: process.env.APP_BASE_URL ?? "https://greenleads.com"
  });
});

app.post("/admin/invites", requireOwner, async (req, res) => {
  const email = req.body.email?.trim() || null;
  const token = crypto.randomBytes(20).toString("hex");
  await prisma.invite.create({
    data: {
      token,
      email: email || null,
      createdById: res.locals.currentUser.id
    }
  });
  res.redirect("/admin/invites");
});

app.post("/admin/invites/:token/revoke", requireOwner, async (req, res) => {
  await prisma.invite.update({
    where: { token: req.params.token },
    data: { revokedAt: new Date() }
  });
  res.redirect("/admin/invites");
});

app.post("/admin/users/:id/toggle", requireOwner, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user || user.role === "OWNER") {
    return res.redirect("/admin/invites");
  }
  await prisma.user.update({
    where: { id: req.params.id },
    data: { active: !user.active }
  });
  res.redirect("/admin/invites");
});

app.get("/import", async (_req, res) => {
  const settings = await getSettings();
  res.render("import", { error: null, success: null, settings });
});

app.post("/import", async (req, res) => {
  const settings = await getSettings();
  const rawEmail = req.body.rawEmail ?? "";
  if (!rawEmail.trim()) {
    return res.render("import", {
      error: "Paste a raw email message.",
      success: null,
      settings
    });
  }

  const parsed = await parseRawEmail(rawEmail);
  const candidate = buildLeadCandidate(parsed, settings);
  if (!candidate) {
    return res.render("import", {
      error: "Could not detect a Nextdoor post link or city.",
      success: null,
      settings
    });
  }

  if (candidate.score < settings.threshold) {
    return res.render("import", {
      error: `Score ${candidate.score} below threshold ${settings.threshold}.`,
      success: null,
      settings
    });
  }

  const existing = await prisma.lead.findUnique({
    where: { postUrl: candidate.postUrl }
  });
  if (existing) {
    return res.render("import", {
      error: "That post URL already exists.",
      success: null,
      settings
    });
  }

  await prisma.lead.create({
    data: {
      source: candidate.source,
      postUrl: candidate.postUrl,
      title: candidate.title,
      snippet: candidate.snippet,
      rawSender: candidate.rawSender,
      receivedAt: candidate.receivedAt,
      city: candidate.city,
      category: candidate.category,
      score: candidate.score,
      rawBody: candidate.rawBody
    }
  });

  return res.render("import", {
    error: null,
    success: "Lead imported successfully.",
    settings
  });
});

const supportAnswer = (question: string) => {
  const q = question.toLowerCase();
  if (q.includes("invite") || q.includes("access")) {
    return "Access is invite-only. Please contact the owner to receive a private invite link.";
  }
  if (q.includes("price") || q.includes("cost") || q.includes("subscription")) {
    return "GreenLeads is private and access is granted directly by the owner.";
  }
  if (q.includes("nextdoor") || q.includes("scrape")) {
    return "GreenLeads only processes emails you already receive. It does not scrape or automate Nextdoor.";
  }
  if (q.includes("data") || q.includes("privacy")) {
    return "Leads are stored privately and email bodies are only stored if the admin enables it.";
  }
  return "Please contact support for help with your account or access.";
};

app.get("/support", (_req, res) => {
  res.render("support", {
    contactEmail: ownerEmail,
    answer: null,
    question: ""
  });
});

app.post("/support", (req, res) => {
  const question = String(req.body.question ?? "");
  res.render("support", {
    contactEmail: ownerEmail,
    answer: supportAnswer(question),
    question
  });
});

const parseList = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseKeywordConfig = (body: Record<string, string>): KeywordConfig => ({
  landscaping: {
    strong: parseList(body.landscapingStrong ?? ""),
    weak: parseList(body.landscapingWeak ?? "")
  },
  install: {
    strong: parseList(body.installStrong ?? ""),
    weak: parseList(body.installWeak ?? "")
  },
  negative: parseList(body.negativeKeywords ?? "")
});

app.get("/settings", async (_req, res) => {
  const settings = await getSettings();
  res.render("settings", {
    settings,
    ingestionEnabled: process.env.INGESTION_ENABLED !== "false"
  });
});

app.post("/settings", async (req, res) => {
  const keywordConfig = parseKeywordConfig(req.body);
  const cityList = parseList(req.body.cityList ?? "");
  const smsTargets = parseList(req.body.smsTargets ?? "");
  const emailTargets = parseList(req.body.emailTargets ?? "");

  await updateSettings({
    keywordConfig,
    cityList,
    threshold: Number(req.body.threshold ?? 3),
    pollIntervalMinutes: Number(req.body.pollIntervalMinutes ?? 3),
    rateLimitPerHour: Number(req.body.rateLimitPerHour ?? 10),
    storeRawEmail: req.body.storeRawEmail === "on",
    smsTargets,
    emailTargets
  });

  res.redirect("/settings");
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
