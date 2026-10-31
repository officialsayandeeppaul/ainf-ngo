# Production release: theainf.in

How the AINF site goes live on **https://theainf.in** from the **client's own Vercel
account** while the source code stays in this private repository.

Release branch: `release/v1`. Every push to it deploys production (once the
deploy secrets below exist). `main` keeps deploying the beta site as before.

---

## 1. Already done (31 Oct 2026)

| Item | State |
|---|---|
| Production database (Neon project "All Indian Nevarlands", branch `production`, Singapore) | All 18 migrations applied |
| Content | 6 field projects, 5 donation missions, payment settings (payments **on**), 3 membership plans, 10% yearly discount, donation minimum ₹200 and suggested amounts copied from beta. No beta users, payments or test data. |
| Super admin | `contact@theainf.in` is set up as the only super admin. It activates on the first sign-in with that email (see section 5). |
| Environment file | `.env.production`, kept **outside** the repository, with every production value plus a generated `PAN_HASH_SALT` and `SUPER_ADMIN_BOOTSTRAP_KEY`. |
| Accounts checked | Clerk, Neon, Upstash, Razorpay, Didit (API key + "Free KYC" workflow) answer correctly. Resend key is send-only and the `theainf.in` domain is verified. |
| Didit webhook handler | Follows Didit's spec: signature first, freshness from the signed body `timestamp`, data edits keyed on `event_id`, failed deliveries reprocessed on retry. |

---

## 2. Deploy to the client's Vercel account (no code access)

**How it works:** GitHub Actions builds the site from this repository and uploads
only the build output to the client's Vercel project (`vercel deploy --prebuilt`).
The client's project is not connected to Git, so the client can manage
deployments, domains, logs and environment variables but cannot see the
repository, its history or the source files.

Be clear with the client about the limit of this: the uploaded output contains
compiled and minified JavaScript. That is not the source and is not practical
to work on, but it is not encrypted either. Ownership of the code should also be
covered in your written agreement.

### Client does (about 10 minutes)

1. **Vercel account and team.** Use a **Pro** team: Vercel's free Hobby plan is
   for non-commercial use only, and the site takes payments.
2. **Create a token for the developer.** Vercel → avatar → **Account Settings →
   Tokens → Create**. Name it `AINF deploys`, scope it to the AINF team and pick
   an expiry. Send it to the developer privately (not in a group chat). The
   client can revoke it at any time, and that immediately stops deploys.
3. **Share two IDs:**
   - **Team ID:** Team → Settings → General.
   - **Project ID:** created in the next step.

### Developer does (once)

1. **Create the project in the client's team** (empty, no Git connection):
   ```bash
   npx vercel@63.1.2 project add ainf-production --scope <client-team-slug> --token <client-token>
   npx vercel@63.1.2 link --yes --project ainf-production --scope <client-team-slug> --token <client-token>
   ```
   `.vercel/project.json` now holds `orgId` (Team ID) and `projectId`. Then
   delete the `.vercel` folder: the workflow links by itself.
2. **Settings in the client's project:** **Settings → Environment Variables →
   Import .env**, choose `.env.production`, environment **Production**, then save.
   - Do **not** tick "Sensitive" on `DATABASE_URL`, `DIRECT_URL` or any
     `NEXT_PUBLIC_*` variable. The build reads them (migrations,
     pre-rendered project list, public keys), and Sensitive values cannot be
     read back by a build. Other secrets can be marked Sensitive.
   - **Settings → General → Node.js Version:** 22.x.
   - **Settings → Security → Build Logs and Source Protection:** on.
3. **GitHub secrets** in this repository (Settings → Secrets and variables →
   Actions):

   | Secret | Value |
   |---|---|
   | `VERCEL_TOKEN` | the client's token |
   | `VERCEL_ORG_ID` | Team ID |
   | `VERCEL_PROJECT_ID` | Project ID |

4. **Deploy:** Actions → "Deploy production (client Vercel)" → **Run workflow**
   on `release/v1`, or push to `release/v1`. The run installs, runs the unit
   tests, pulls the settings, applies database migrations, builds, and uploads.
   The deployment URL appears in the run summary.

### Domain (client, or whoever manages Hostinger DNS)

`theainf.in` currently points at Google (216.239.32–38.21), not Vercel.

1. Client's Vercel project → **Settings → Domains → Add** `theainf.in`, then
   `www.theainf.in` with "redirect to theainf.in".
2. Hostinger → DNS for theainf.in: replace the four `A` records for `@` with
   the record Vercel shows (normally `A @ 76.76.21.21`), and set `www` to the
   `CNAME` Vercel shows. **Keep** the Resend records (`resend._domainkey`,
   `send` MX/TXT): removing them stops email.
3. Wait for Vercel to show both domains as **Valid Configuration**. The SSL
   certificate is issued automatically.

Until the DNS points at Vercel, Razorpay and Didit webhooks to theainf.in
cannot be delivered.

---

## 3. One-time items still open

| What | Why | How |
|---|---|---|
| **Didit webhook destination** | Pushes verification results to the site the moment Didit decides. Without it members' results still arrive when they return from Didit, but not if they close the tab. | Didit console → **Webhooks → Add destination**: URL `https://theainf.in/api/webhooks/didit`, version **v3**, events `status.updated` and `data.updated`. Copy its secret into `DIDIT_WEBHOOK_SECRET` in Vercel and redeploy. |
| **Clerk production instance** | The current keys are a development instance: Clerk shows a "Development mode" badge and applies development limits. | Clerk → create a Production instance for `theainf.in`, add its DNS records in Hostinger, replace both Clerk keys in Vercel, redeploy. The super admin row links on first sign-in in the new instance as well. |
| **Razorpay live mode** | Current keys are `rzp_test_`: checkout works but no real money moves. | Complete Razorpay KYC → Live mode → create live API keys and the same webhook (`https://theainf.in/api/webhooks/razorpay`) with its **own** random secret → replace the three Razorpay values → redeploy. |
| Clerk webhook (optional) | Keeps profile edits and deletions in sync. | Clerk → Webhooks → `https://theainf.in/api/webhooks/clerk`, events `user.created`, `user.updated`, `user.deleted` → secret into `CLERK_WEBHOOK_SIGNING_SECRET`. |
| APITXT sender id (optional) | Plain text-message notices (verification result, suspension). OTP works without it. | Once APITXT approves a sender id, add `APITXT_SENDER_ID`. |

After changing any variable in Vercel, **redeploy** (Deployments → latest →
Redeploy, or re-run the workflow): running deployments keep their old values.

---

## 4. Check after the first deploy

1. `https://theainf.in` loads with a padlock; `www` redirects to it.
2. `/donate-now`: the donation window opens and the Razorpay test checkout appears.
3. `/sign-up`: create an account, then `/account` loads.
4. `/account/membership` lists Friend of AINF, Gold member and Patron.
5. Sign in as `contact@theainf.in` and open `/admin`.
6. Razorpay dashboard → Webhooks → the theainf.in webhook shows successful deliveries after a test payment.

## 5. Super admin

`contact@theainf.in` already has super admin rights in the production
database. To activate them, open `https://theainf.in/sign-up`, sign up with
that exact email and confirm the code Clerk sends. The account links to the
admin record automatically, and the setup is in the audit log.

`SUPER_ADMIN_BOOTSTRAP_KEY` is only for creating a super admin through
`/admin/bootstrap` (for example in a new database). A second super admin can be
created from **Admin → Users** by the first one.

## 6. Everyday releases

```bash
git checkout release/v1
git merge --ff-only main     # what beta has been running
git push origin release/v1   # deploys production
```

- **Database changes** need no extra step: the build applies pending
  migrations before the new code goes live. If a migration fails, the run fails
  and the live site stays on the previous version.
- **Rollback:** client's Vercel → Deployments → pick the previous production
  deployment → **Instant Rollback**. A rollback does not undo database migrations,
  and migrations here only ever add.
