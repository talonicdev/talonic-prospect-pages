---
name: prospect-page
description: Turn a prospect meeting transcript into a private, password-gated page live at talonic.com/<customer>, with a voiced walkthrough video and a PDF download, published through Talonic's publish API (no website repo needed). Use when someone at Talonic asks to make a prospect page, pilot page, follow-up page or one-pager from a call, transcript or meeting notes, to change a page at talonic.com/<slug>, or to store their prospect publish key.
---

# Prospect page from a transcript

You turn a discovery-call transcript into a private page at `talonic.com/<slug>` behind a shared password, with a video and a PDF. Everything runs through the CLI shipped with this plugin:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/prospect.mjs" <command> …
```

Call it `prospect` below. It needs Node 18+, Google Chrome (for the PDF) and a publish key. If a command fails with "no publish key", ask the sender for their key (an admin creates one with `prospect keys create <email>`) and run `prospect login --key tpk_…`. If they paste a key in chat, store it the same way and tell them it is saved in `~/.config/talonic/prospect.json`.

Work in a folder outside any repo: `~/talonic-prospects/<slug>/`. Create it if missing. Never write into the website repo.

## 1. Gather

Ask only for what you cannot find yourself, in one message:

- **The transcript**: a file path or pasted text. Meeting-tool summaries are fine, but prefer the full transcript.
- **Who sends it**: their name and `@talonic.ai` email, for the footer and the mailto.
- **The slug**: default is the customer name in lowercase (`acme`). Run `prospect list` and check it is free, unless this is an update to that page.
- **The customer logo**: a file, or fetch it from the customer's website header. Save it as `customer-logo.png` or `.svg` in the work folder. Without one, the login screen sets the name in type.

Do not ask for a password yet. The sender creates it at the end, when they decide to put the page online (step 6).

## 2. Read the call

Write `brief.md` in the work folder before any HTML. Ground every line in the transcript:

- The page type. **Pilot proposal** if a pilot or next step was agreed (shape: When unsure, ask.
- The prospect's problems, in their own words, with the person who said them.
- Every system they named (ERP, CRM, contract tool). Transcripts mishear names: AFAS often appears as "Avast" or "abas". Check against context.
- People, roles and who owns which system.
- Agreed next steps and dates, exactly as agreed. Convert relative dates ("next Friday") to real dates.
- Anything Talonic promised (a connector by tonight, a scoping doc).

Show the sender a short version of the brief (type, three to five problems, systems, people, next steps) and ask them to correct it. Do not write the page until they confirm.

## 3. Write the page

Copy `${CLAUDE_PLUGIN_ROOT}/skills/prospect-page/template.html` to `<work>/page.html` and fill every `FILL` comment, then delete the comments. Keep the styles and section order. Remove sections that do not apply rather than padding them.

Rules that are not optional:

- **No invented claims.** No figures, savings, customers or capabilities that were not on the call or in the template's proof footer. A follow-up page recaps the call and makes no pilot offer.
- **Their words.** Headline and chips come from what the prospect said. Name only systems they named.
- **Money Found wording.** Say "revenue never billed", never "contracts owe you money". Meeting CTAs say "our team". Do not list overbilling as a hunt chip.
- **Access checklist** from `references/access.md`, one column per named system. For systems not listed there, use the generic checklist and tell the sender what still needs confirming.
- **People.** Use first names and roles as they came up on the call. The page is private, but it is still about real people: no judgements about individuals.
- **Images.** Talonic and client logos stay as `/logos/...` (the build resolves them from the plugin's `assets/`). Anything else goes in the work folder and is referenced by file name.
- **Design.** Light theme only, square corners, hairline borders, one violet accent. No horizontal scroll at 400 px: keep diagrams inside `min-width: 0` columns.

**Follow-up pages** (no pilot agreed): header with both logos and Download PDF, a thank-you intro restating the pitch as made on the call, *What you saw* (one line per demo step, in order), *Where it fits what you shared* (their use cases mapped to what the demo showed, nothing the demo did not show), how we work as stated on the call, the proof footer, and next steps exactly as agreed. If they said "reconnect in early November", do not turn it into a pilot offer.

## 4. Video (default on)

Every page gets a voiced walkthrough of 35 to 50 s unless the sender says no video. Write `<work>/storyboard.json` from the confirmed brief following `references/storyboard.md`: a title card, four to six scenes over real platform screens from the service's library (`prospect screens` lists them with their highlight boxes), optional overlay cards marked "Illustrative example", one voice line per scene, and the closing line "Let's go find some money." Then:

```sh
prospect video <work>          # renders on the render service, saves walkthrough.mp4 and poster.jpg
```

It takes one to three minutes. If the render service is unreachable, say so, build the page without the video and offer to add it later. Never promise a video you have not rendered.

## 5. Review locally, as many rounds as it takes

```sh
prospect preview <work> --pdf-name Talonic-<Customer>-Pilot.pdf
```

`preview` builds the page (images inlined, PDF printed with Chrome) and opens `<work>/build/preview.html` in the sender's browser with the video and PDF links pointing at the local files. Nothing is uploaded. Read the PDF and fix anything that breaks across pages. If you have a browser tool, open the preview yourself and check: no horizontal scroll at 400 px, the video plays, the PDF link downloads, every `FILL` comment is gone.

Then guide the sender through the review. Many senders have never done this, so lead:

- Tell them the preview is open in their browser and that **it exists only on their computer**; nobody else can see it.
- Ask them to read it top to bottom as the prospect would, and offer three or four concrete things to check: the headline in the prospect's words, the people and systems named correctly, the next steps and dates, the video.
- Take their changes in plain language ("shorter title", "drop the timeline", "change the voice line in scene 3", "Koen is the AFAS admin, not Ruud"). Edit `page.html` or `storyboard.json`, re-run `prospect video` only when the storyboard changed, then `prospect preview` again and say what changed.
- After each round ask: *"Anything else, or are you happy with it?"* Keep going as long as they want. Never upload because a round went quiet; wait for them to say they like it.

## 6. When they like it: remind, create the password, upload the draft

As soon as the sender says they are happy, remind them of both things, in your own words:

> The page is still only on your computer. To share it, it has to be pushed online to **talonic.com/<slug>**. It will sit behind a password that you create now. Pick something easy to read out but hard to guess, for example two words and two digits (`harbor-lantern-42`). Don't use the customer's name or the topic. You'll send the password to the prospect separately from the link.

Wait for them to give you the password. If they ask you to suggest one, offer two or three in that shape and let them choose. Confirm the slug (`talonic.com/<slug>`, run `prospect list` to check it is free). Then upload the draft:

```sh
prospect draft <slug> --work <work> --password '<their password>' --customer "<Customer>" \
  --title "Talonic × <Customer>" --heading "<pilot name>" --note "first draft"
```

`draft` uploads page, PDF, logo and media and prints `talonic.com/<slug>/draft`, behind their password. Ask them to open it once and log in. The live address does not exist yet. The draft link is fine to share inside Talonic, not with the prospect.

## 7. Publish when they say so

Publishing makes the page live at `talonic.com/<slug>`. Show the sender the address, their password and one paragraph on what the page says, and wait for a clear go-ahead ("publish", "put it live"). Then:

```sh
prospect publish <slug>
```

Check the live URL returns the login (`curl -sI https://talonic.com/<slug>` → 401) and report back: the URL, a reminder to send the password separately from the link, what was verified, and anything you could not confirm (for example access details marked as needing the prospect's admin).

Later changes follow the same loop: edit, `prospect preview` locally, `prospect draft` (no password needed again), `prospect publish`. Mistake live? `prospect rollback <slug> --version <n>` restores an earlier version at once. `prospect info <slug>` lists versions and who published what.

## Updating a page someone else made

`prospect pull <slug>` downloads the current files into `prospect-<slug>/`; its `page.html` already has images inlined and media links in place, so edit it directly, skip `build` unless you need a new PDF, and upload with `prospect draft <slug> --page page.html --force` (the page belongs to its first publisher; `--force` is logged). Changing the password (`prospect password`) signs every reader out.
