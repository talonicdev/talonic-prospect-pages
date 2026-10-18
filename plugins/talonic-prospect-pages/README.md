# talonic-prospect-pages

A Claude Code plugin that takes a discovery-call transcript to a private page at `talonic.com/<customer>`: password-gated, with a voiced walkthrough video and a PDF, published through the website's publish API. No website repo, no build, no merge.

## Set up once

1. Install the plugin (see the marketplace README).
2. Get a publish key from an admin (they run `prospect keys create you@talonic.ai`), then in a terminal:
   ```sh
   node "$(claude plugin path talonic-prospect-pages 2>/dev/null || echo ~/.claude/plugins/cache/talonic/talonic-prospect-pages/*)/scripts/prospect.mjs" login --key tpk_…
   ```
   or simply ask Claude: *"store my prospect key tpk_…"*. The key is kept in `~/.config/talonic/prospect.json`.
3. Google Chrome installed (prints the PDF).

## Use

In Claude Code, paste the transcript and say what you want:

> make a prospect page for Acme from this transcript — pilot proposal, send it as Nikolas

Claude confirms a short brief, writes the page, renders the video, and opens a **local preview** in your browser. Only you can see it. Ask for changes in plain language and go as many rounds as you like.

When you're happy, Claude reminds you that the page still has to be **pushed online** to `talonic.com/acme`, and asks you to **create a password** for it. It uploads a draft you can check at `talonic.com/acme/draft`, then publishes to `talonic.com/acme` when you say so. Send the prospect the link and the password separately.

## The CLI underneath

`scripts/prospect.mjs` (Node 18+, no dependencies):

```
prospect login --key tpk_…        prospect list              prospect info <slug>
prospect build <workdir>          prospect video <workdir>   prospect draft <slug> --work <workdir>
prospect preview <workdir>          build and open build/preview.html locally, nothing uploaded
prospect publish <slug>           prospect rollback <slug> --version n
prospect password <slug> --password …     prospect pull <slug>     prospect delete <slug>
prospect keys list|create <email>|revoke <id>     (admin secret only)
```

Env: `TALONIC_PROSPECT_KEY`, `TALONIC_PROSPECT_API` (default `https://talonic.com/api/prospects`), `TALONIC_RENDER_API` (the video render service, default `https://prospect-render-production.up.railway.app`).

## Layout

- `skills/prospect-page/SKILL.md`: the flow Claude follows.
- `skills/prospect-page/template.html`: the page template.
- `skills/prospect-page/references/access.md`: read-access checklists per system.
- `skills/prospect-page/references/storyboard.md`: how to write the video storyboard.
- `scripts/prospect.mjs`: the CLI.
- `assets/logos/`: Talonic, client and DIN logos the template uses.

Server side: `src/lib/prospects/` in the website repo (`docs/prospect-pages.md` there).
