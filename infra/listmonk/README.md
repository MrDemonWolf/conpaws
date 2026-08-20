# MrDemonWolf, Inc. self-hosted mailing lists

This deploys one shared [Listmonk](https://listmonk.app) 6.2.0 install for MrDemonWolf, Inc. on Dokploy at `lists.mrdemonwolf.com`. ConPaws is its first product; later products get their own lists inside the same install rather than a second deployment.

`mrdemonwolf.dev` is reserved for preview domains, so this lives on the business domain even though the mail it sends is ConPaws marketing. Sending identity and blast radius are set by the SES identity and configuration set, not by the hostname of the admin UI.

Durable data lives in a separate Dokploy PostgreSQL service. **That database is the consent record** — the subscriber rows, their opt-in timestamps, and their source are the only evidence that anyone agreed to be emailed. Back it up before you send anything, not after.

Deploying this alone sends no mail and moves nothing off Brevo.

## Do this in order

1. Create a Dokploy PostgreSQL Database service for Listmonk.
2. Configure its backups to R2 and prove a restore.
3. Deploy `compose.dokploy.yml` and route `lists.mrdemonwolf.com` to port `9000`.
4. Secure the seeded super admin, then remove the bootstrap variables.
5. Generate SES SMTP credentials and connect SMTP.
6. Configure bounce processing, including the global-blocklist thresholds.
7. Create the ConPaws list with double opt-in and verify the confirmation flow end to end.

Never put real secrets in `.env.example`, Git, build logs, or a support ticket. Enter them directly in Dokploy and AWS.

## 1. Database and backups

Create a Dokploy PostgreSQL Database service. Copy its exact internal host, port, user, password, and database name into the Dokploy environment for the Compose application — Dokploy prints the real internal hostname, and guessing it produces a container that starts, fails `--install`, and restarts forever.

`DB_SSL_MODE=disable` in `.env.example` is correct only while Postgres is a private service on the same host. Any external or cross-host database must use `require` or stricter.

Schedule Dokploy's database backup to the private R2 backup bucket (`mrdemonwolf-ota-backups` already exists and can hold a `listmonk/` prefix, or create a dedicated bucket). Nightly at 03:00 UTC, keep 30. Give the backup destination a token scoped only to that bucket.

A backup that has never been restored is not a backup. Before the first campaign, restore the dump into a throwaway database and confirm the `subscribers` table comes back with its `created_at` values intact. Those timestamps are the consent evidence; a restore that silently rewrites them is worse than no restore.

Media uploads live in the `listmonk-uploads` Docker volume, not in Postgres. They are not covered by the database backup and are not consent data — losing them breaks images in already-sent campaigns and nothing else.

## 2. Deploy in Dokploy

Create a Dokploy Compose application from `infra/listmonk/compose.dokploy.yml`. The image is digest-pinned, so a moved upstream tag cannot change what runs.

Copy the variable names from `.env.example` into Dokploy and replace every placeholder:

| Area | Variables |
| --- | --- |
| Database | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL_MODE` |
| Bootstrap admin | `ADMIN_USER`, `ADMIN_PASSWORD` |

Route `lists.mrdemonwolf.com` to port `9000`. The container runs `--install --idempotent` then `--upgrade` on every start, so restarts are safe and an image bump applies its own schema migrations. Take a database backup before bumping the image anyway — Listmonk's own upgrade docs open with that warning, and migrations are not reversible.

The container is `read_only` with a tmpfs `/tmp` and a named volume for uploads. If a future version needs another writable path it will fail loudly at startup rather than silently losing data; add a tmpfs or volume for that path rather than dropping `read_only`.

Log in, change the seeded admin's password, then **delete `ADMIN_USER` and `ADMIN_PASSWORD` from Dokploy and redeploy**. They are read only at first install, but leaving them set leaves a working credential in the deployment config.

## 3. SMTP through SES

In Listmonk, go to Settings → SMTP.

| Field | Value |
| --- | --- |
| Host | `email-smtp.us-east-1.amazonaws.com` |
| Port | `587` |
| Auth protocol | `plain` (LOGIN also works) |
| TLS | `STARTTLS` |
| Max connections | Start at `5` |
| Max message rate | Keep total sends under the account's 14/sec |

**The SES SMTP username and password are generated in the SES console under SMTP settings. They are not IAM access keys.** SES derives an SMTP password from an IAM secret through a signing algorithm; pasting an IAM access key ID and secret into these fields fails authentication with no useful error. Generate the credential pair in SES, store it in the password manager, and paste it here.

Add the configuration set as a custom header in the same SMTP settings block:

```json
[
    {"X-SES-CONFIGURATION-SET": "conpaws"}
]
```

SMTP sends have no other way to name a configuration set. Omit this header and every campaign silently loses the `conpaws` tenant's suppression isolation and its per-product reputation metrics — the mail still sends, which is what makes the mistake expensive to notice.

Set the campaign From address on the ConPaws sending domain (`conpaws.com`, with the verified custom MAIL FROM at `e.conpaws.com`), not on `mrdemonwolf.com`. The whole point of the provider split is that a ConPaws marketing incident cannot reach the business domain's mail.

## 4. Bounce processing

Settings → Bounces, following Amazon's own recommendations:

| Setting | Value |
| --- | --- |
| Enable bounce processing | Enabled |
| Soft — count / action | `2` / None |
| Hard — count / action | `1` / Blocklist |
| Complaint — count / action | `1` / Blocklist |
| Enable bounce webhooks | Enabled |
| Enable SES | Enabled |

**Blocklisting is install-global, not per-list.** A subscriber blocklisted by a ConPaws bounce is blocklisted for every product that later shares this install. That is the correct default for hard bounces and complaints — those addresses should never be mailed again by anyone — but it is why soft bounces must stay on `None`. A full mailbox on a Tuesday is not consent withdrawal, and an aggressive soft threshold quietly removes people from lists they never had a problem with.

Then wire SES to it:

1. SNS → create a Standard topic (`ses-conpaws-bounces`, separate from the existing `ses-conpaws-events` alarm topic).
2. Create an HTTPS subscription with endpoint `https://lists.mrdemonwolf.com/webhooks/service/ses` and **raw message delivery disabled**.
3. SES will call the endpoint to confirm; refresh until the subscription reads Confirmed. If it stays pending, the endpoint is wrong or not publicly reachable yet.
4. In SES, attach the topic to the `conpaws` identity's bounce and complaint notifications.

Confirm the subscription from the SNS console, not from a link in a browser page you are unsure about — the AWS page shown after confirming carries an unsubscribe link, and clicking it deletes the subscription while the console still displays a stale "Confirmed".

Mailbox-simulator sends exercise this path but do not move reputation rates; they publish counts only. Use them to prove the webhook fires, not to judge deliverability.

## 5. Lists, consent, and the ConPaws migration

Create a `ConPaws Beta` list, type `public`, opt-in `double`.

Open question to settle in the running instance: Listmonk serves its own confirmation page after opt-in, whereas Brevo redirects to `https://conpaws.com/confirmed` (`BREVO_DOI_REDIRECT_URL`). The `/confirmed` route exists on the site now. Before cutting over, confirm how this version of Listmonk hands off after confirmation and point it at that URL, or accept Listmonk's own page and update the runbook to say so. Do not cut over on the assumption that the Brevo redirect variable carries across — it does not.

D1 remains the source of truth for the waitlist. Listmonk is a sender, not the record. Whatever syncs into it must preserve each subscriber's original `created_at` and a `source` attribute, because a re-stamped timestamp destroys the only evidence of when that person consented.

The six SeedProd subscribers import as `status: confirmed` with `source: seedprod-import` and their original timestamps. They get a "we moved" note, never a re-confirmation request — asking people to re-confirm consent you already hold is how a list of six becomes a list of two.

## Verify before the first campaign

- [ ] Restore drill passed, `created_at` intact.
- [ ] `ADMIN_USER` / `ADMIN_PASSWORD` removed from Dokploy.
- [ ] Test campaign to a real inbox passes SPF, DKIM, and DMARC alignment on `conpaws.com`.
- [ ] That test message's headers show it was tracked against the `conpaws` configuration set.
- [ ] A mailbox-simulator hard bounce reaches `/webhooks/service/ses` and lands in Listmonk's bounce log.
- [ ] Unsubscribe link works and the subscriber's status flips.

## Related

- `infra/xprem/` — the other MrDemonWolf Dokploy Compose application; same conventions
- `notes/prerelease-site.md` — ESP decision record and the going-live runbook
- Memory: `email-sending-stack`, `domain-ladder-for-projects`, `esp-choice-scales-per-product`
