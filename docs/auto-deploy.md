# Automatic Deployment

The site is deployed by GitHub Actions to Cloudflare Pages.

## Triggers

The workflow in `.github/workflows/deploy.yml` runs when:

- code is pushed to `main`
- the workflow is started manually in GitHub Actions
- a `repository_dispatch` event with type `obsidian-updated` is received
- the schedule runs every 12 hours, at 08:00 and 20:00 Asia/Shanghai

During each run, the workflow:

1. checks out the site repository
2. pulls public Markdown from the R2 bucket
3. builds the Astro site
4. copies the Pages `_worker.js` API into `dist/`
5. deploys `dist/` to Cloudflare Pages

## Required GitHub Secrets

Add these in GitHub repository settings:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

The Cloudflare API token needs permission to deploy the Pages project. The R2 access keys need read access to the `obsidian-sync` bucket.

## Required Pages Secrets and Variables

- `ADMIN_TOKEN`: required for hidden admin export APIs.
- `TURNSTILE_SECRET_KEY`: required to enforce Turnstile on subscribe, contact, and feedback writes.
- `PUBLIC_TURNSTILE_SITE_KEY`: Pages build variable used to render the Turnstile widget on public forms.

## Pages Function Bindings

The root `wrangler.toml` binds three KV namespaces to the Cloudflare Pages project:

- `SUBSCRIBERS`: stores opt-in email subscriptions and unsubscribe tokens from `/api/subscribe`
- `SITE_METRICS`: stores anonymous aggregate page-view counters from `/api/visit`
- `CONTACT_MESSAGES`: stores lightweight contact form backups from `/api/contact`

The admin export endpoint `/api/admin/subscribers` requires the `ADMIN_TOKEN` Pages secret.
The admin contact export endpoint `/api/admin/contacts`, sync report endpoint `/api/admin/content-sync-report`, and newsletter draft endpoint `/api/admin/newsletter-draft?since=YYYY-MM-DD` use the same token.

The public API lives in `public/_worker.js`, which Astro copies into `dist/` during build.

## Optional GitHub Variables

Defaults are already built into the script, so these are optional:

- `OBSIDIAN_R2_BUCKET`: defaults to `obsidian-sync`
- `OBSIDIAN_R2_NOTES_PREFIX`: defaults to `Homepage/Notes/`
- `OBSIDIAN_R2_PAPERS_PREFIX`: defaults to `Homepage/Papers/`
- `OBSIDIAN_R2_PROJECTS_PREFIX`: defaults to `Homepage/Projects/`
- `OBSIDIAN_R2_LIBRARY_PREFIX`: defaults to `Homepage/Library/`
- `OBSIDIAN_R2_TIMELINE_PREFIX`: defaults to `Homepage/Timeline/`
- `OBSIDIAN_R2_ROADMAP_PREFIX`: defaults to `Homepage/Roadmap/`

## Publish Rule

Notes are private by default. A Markdown file is published only when its frontmatter explicitly contains one of:

```yaml
draft: false
publish: true
public: true
status: public
```

## Change-triggered Deployment

The workflow accepts `repository_dispatch` with type `obsidian-updated`.

R2 object changes are handled by `workers/obsidian-r2-dispatcher`:

1. R2 sends matching object events to the `obsidian-r2-deploy-events` Queue.
2. The Worker consumes the queue.
3. The Worker calls GitHub's `repository_dispatch` API for this repository.
4. GitHub Actions rebuilds the site from R2 and deploys it to Cloudflare Pages.

The Worker filters for Markdown files under:

- `Homepage/Notes/`
- `Homepage/Papers/`
- `Homepage/Projects/`
- `Homepage/Library/`
- `Homepage/Timeline/`
- `Homepage/Roadmap/`

Keep the scheduled 12-hour run as a fallback in case an event is missed.

## Worker Secret

The Worker needs one secret:

- `GITHUB_DISPATCH_TOKEN`

This token should have permission to create a `repository_dispatch` event for `dreamkeeperhu/dreamkeeperhu.github.io`. GitHub documents this endpoint as requiring `Contents` repository permission with write access for fine-grained tokens.
