# GreenLeads (Internal)

Private app to detect landscaping or install requests from your own Nextdoor notification emails. It does **not** scrape or automate Nextdoor browsing.
GreenLeads is invite-only and controlled by the owner.

## Compliance
- Only ingests emails you already receive or forward to a dedicated mailbox/label.
- No programmatic login or browsing on Nextdoor.

## Tech
- Node.js + TypeScript
- Express (server-rendered EJS views)
- Postgres + Prisma
- Background worker polls email every few minutes

## Setup
1. Create a Postgres database (example name: `nextdoor_leads`).
2. Copy `.env.example` to `.env` and fill in values.
   - Set `OWNER_EMAIL` to the owner account email.
   - Set `APP_BASE_URL` to your public URL (used for invite links).
3. Install dependencies:

```bash
npm install
```

4. Run migrations (choose one):

```bash
npx prisma migrate dev --name init
```

Or apply the SQL in `prisma/migrations/000_init/migration.sql` directly.

5. Create owner account:

Open `http://localhost:3000/signup` and create the first account with your owner email. After that, all signups require an invite link.

6. Start server + worker (worker optional if you only use manual import; set `INGESTION_ENABLED=false`):

```bash
npm run dev
npm run worker
```

Open `http://localhost:3000` and log in.

## Invites (Owner Only)
Use the Invites page to generate private invite links. You can revoke access at any time or deactivate users.

## Support
Support page includes contact email and basic rules/FAQ.

## Deployment (Render + GoDaddy)
1. Push this repo to GitHub.
2. In Render, create a new Web Service from the repo (or use `render.yaml`).
3. Set environment variables (Render dashboard):
   - `DATABASE_URL` (Render Postgres external URL)
   - `JWT_SECRET` (random string)
   - `OWNER_EMAIL` (`yassirmohanna@gmail.com`)
   - `APP_BASE_URL` (`https://app.greenleads.com`)
   - `INGESTION_ENABLED` (`false` unless configured)
4. Deploy. Render will build and start the service.
5. In GoDaddy DNS, add a CNAME:
   - Host: `app`
   - Points to: `<your-render-service>.onrender.com`
6. In Render, add your custom domain `app.greenleads.com` and enable TLS.

## Email Providers (Optional)
### IMAP (recommended)
- Set `EMAIL_PROVIDER=imap`.
- Use `IMAP_FOLDER=Nextdoor Leads` to only read a label/folder.
- Use `IMAP_FROM_FILTER=nextdoor` to filter sender.
- For Gmail IMAP, create an App Password and use it in `IMAP_PASSWORD`.

### Gmail OAuth
- Set `EMAIL_PROVIDER=gmail`.
- Create OAuth client in Google Cloud console.
- Add a refresh token to `GMAIL_REFRESH_TOKEN`.
- Optionally set `GMAIL_LABEL=Nextdoor Leads` to only read a label.

## Notifications (Optional)
- SMS via Twilio: set `TWILIO_*` + `SMS_TO_NUMBERS` (comma or newline in Settings).
- Email via SendGrid: set `SENDGRID_API_KEY` + `EMAIL_FROM`.
- SMTP fallback: set `SMTP_*` values.

## Settings
Edit keywords, city list, thresholds, and recipients in the Settings page. These values persist in the DB and take effect without redeploy.

Default keywords live in `config/default-settings.json` and are used to seed the database on first run.

## Tests
```bash
npm test
```

Fixtures are in `tests/fixtures/`.

## Security
- Secrets live in environment variables only.
- Full email bodies are not stored unless `storeRawEmail` is enabled in Settings.
