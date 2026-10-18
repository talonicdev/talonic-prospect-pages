# Talonic prospect pages for Claude Code

A Claude Code plugin for the Talonic team: paste a prospect call transcript, review the page on your own computer, then publish it behind a password at `talonic.com/<customer>`.

Install once, inside any Claude Code session (no GitHub account needed):

```
/plugin marketplace add talonicdev/talonic-prospect-pages
/plugin install talonic-prospect-pages@talonic
```

Publishing needs a personal publish key from a Talonic admin. See `plugins/talonic-prospect-pages/README.md` for the flow and key setup.

Updates: `/plugin marketplace update talonic`, then `claude plugin update talonic-prospect-pages@talonic`. Maintainers: bump `version` in `plugin.json` on every change, or users keep the old copy.
