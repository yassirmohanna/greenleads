import "dotenv/config";
import { prisma } from "./lib/db/client";
import { getSettings, updateSettings } from "./lib/db/settings";
import { createEmailProvider } from "./lib/email/factory";
import { GmailEmailProvider } from "./lib/email/gmailProvider";
import { ImapEmailProvider } from "./lib/email/imapProvider";
import { parseRawEmail } from "./lib/parser/emailParser";
import { buildLeadCandidate } from "./lib/leadProcessor";
import { sendEmailAlerts, sendSmsAlerts } from "./lib/notifications/notifier";

const canSendMoreNotifications = async (limit: number) => {
  const count = await prisma.notificationLog.count({
    where: { sentAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } }
  });
  return count < limit;
};

const wasAlerted = async (postUrl: string) => {
  const existing = await prisma.notificationLog.findFirst({
    where: { postUrl }
  });
  return Boolean(existing);
};

const logNotifications = async (leadId: string, postUrl: string) => {
  await prisma.notificationLog.createMany({
    data: [
      { channel: "SMS", leadId, postUrl },
      { channel: "EMAIL", leadId, postUrl }
    ]
  });
};

const handleMessages = async () => {
  if (process.env.INGESTION_ENABLED === "false") {
    return;
  }

  const settings = await getSettings();
  const provider = createEmailProvider({
    lastImapUid: settings.lastImapUid,
    lastGmailQueryAfter: settings.lastGmailQueryAfter
  });

  const messages = await provider.fetchNewMessages();

  for (const message of messages) {
    const parsed = await parseRawEmail(message.raw);
    if (!parsed.from.toLowerCase().includes("nextdoor")) {
      continue;
    }

    const candidate = buildLeadCandidate(parsed, settings);
    if (!candidate) {
      continue;
    }

    if (candidate.score < settings.threshold) {
      continue;
    }

    const existing = await prisma.lead.findUnique({
      where: { postUrl: candidate.postUrl }
    });
    if (existing) {
      continue;
    }

    const lead = await prisma.lead.create({
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

    if (await wasAlerted(candidate.postUrl)) {
      continue;
    }

    const allowed = await canSendMoreNotifications(settings.rateLimitPerHour);
    if (!allowed) {
      continue;
    }

    await sendSmsAlerts(
      {
        title: lead.title,
        snippet: lead.snippet,
        city: lead.city,
        postUrl: lead.postUrl
      },
      settings.smsTargets
    );

    await sendEmailAlerts(
      {
        title: lead.title,
        snippet: lead.snippet,
        city: lead.city,
        postUrl: lead.postUrl
      },
      settings.emailTargets
    );

    await logNotifications(lead.id, lead.postUrl);
  }

  if (provider instanceof ImapEmailProvider) {
    await updateSettings({ lastImapUid: provider.getLastSeenUid() ?? null });
  }
  if (provider instanceof GmailEmailProvider) {
    await updateSettings({
      lastGmailQueryAfter: provider.getLastQueryAfter() ?? null
    });
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const loop = async () => {
  while (true) {
    try {
      await handleMessages();
    } catch (error) {
      console.error("Worker error", error);
    }

    const settings = await getSettings();
    await sleep(settings.pollIntervalMinutes * 60 * 1000);
  }
};

loop().catch((error) => {
  console.error("Worker crashed", error);
  process.exit(1);
});
