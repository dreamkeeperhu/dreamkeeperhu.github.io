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
4. deploys `dist/` to Cloudflare Pages

## Required GitHub Secrets

Add these in GitHub repository settings:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

The Cloudflare API token needs permission to deploy the Pages project. The R2 access keys need read access to the `obsidian-sync` bucket.

## Optional GitHub Variables

Defaults are already built into the script, so these are optional:

- `OBSIDIAN_R2_BUCKET`: defaults to `obsidian-sync`
- `OBSIDIAN_R2_NOTES_PREFIX`: defaults to `Homepage/Notes/`
- `OBSIDIAN_R2_PAPERS_PREFIX`: defaults to `Homepage/Papers/`

## Publish Rule

Notes are private by default. A Markdown file is published only when its frontmatter explicitly contains one of:

```yaml
draft: false
publish: true
public: true
status: public
```

## Change-triggered Deployment

The workflow already accepts `repository_dispatch` with type `obsidian-updated`.

To make deployment happen immediately after an R2 object changes, connect Cloudflare R2 Event Notifications to a Queue and a small Worker. The Worker should call GitHub's `repository_dispatch` API for this repository. Keep the scheduled 12-hour run as a fallback in case an event is missed.
