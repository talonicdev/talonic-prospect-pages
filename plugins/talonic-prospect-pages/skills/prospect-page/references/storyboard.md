# Writing the video storyboard

`prospect video <work>` sends `<work>/storyboard.json` to the render service and saves `walkthrough.mp4` and `poster.jpg` in the work folder. Timing comes from the measured voice lines, so write the narration and let the service set the clock. Aim for 35 to 50 s in total: that is a title card, four to six scenes and the outro, with voice lines of 8 to 20 words.

```json
{
  "title": { "customer": "Acme Benelux", "subtitle": "Money Found pilot" },
  "label": "Sample contracts · fictional parties",
  "scenes": [
    { "id": "read", "eyebrow": "Read", "headline": "Every service contract, read.", "accent": "Each term tied to its clause.",
      "screen": "contract-read", "highlight": ["rate-clause"],
      "voice": "Talonic reads every service contract. Rates, indexation, notice, expenses: each tied to its clause." },
    { "id": "reg", "eyebrow": "Aggregate", "headline": "One register for all contracts.", "accent": "Every deadline in view.",
      "screen": "contract-register", "highlight": ["row"],
      "voice": "All of it lands in one register, with every deadline in view." },
    { "id": "miss", "eyebrow": "Fill the gaps", "headline": "Amendments we can't find become", "accent": "a to-do list.",
      "card": { "title": "Missing documents", "rows": ["Amendment 2 · referenced in clause 4.1 · not on file", "Extension 2024 · referenced in invoice note · not on file"] },
      "voice": "Amendments that are referenced but not on file become a list you can fill in later." },
    { "id": "plan", "type": "timeline", "eyebrow": "The plan", "headline": "Findings", "accent": "before mid-November.",
      "steps": [ { "when": "This week", "what": "Connectors built", "who": "By Talonic" }, { "when": "Fri 23 Oct", "what": "Alignment", "who": "Susanne, Ruud, Tiffany", "key": true } ],
      "voice": "Connectors this week. Alignment on the twenty-third. Then access, one audit week, and findings before mid-November." }
  ],
  "outro": { "headline": "Let's go find", "accent": "some money.", "voice": "Let's go find some money." }
}
```

Rules:

- **Eyebrows are one word, no number.** The service prefixes the scene number itself (`01 · Read`); a number in the eyebrow shows twice.
- **Screens come from the library.** `prospect screens` lists ids, what each shows and its highlight box ids. They are real platform screens of fictional sample contracts; keep the `label` so the viewer knows.
- **Cards are for things the screens cannot show** (a missing-documents list, the agents' hunt list). The service marks them "Illustrative example". Rows must come from the brief, not from imagination.
- **Voice lines are the brief in spoken English.** Numbers as words ("the twenty-third"). No claims that are not on the page.
- **Timeline steps** mirror the page's timeline, same dates.
- **Outro** always closes on "Let's go find some money." for a pilot page; for a follow-up page close on the agreed next step instead.

Re-render only when the storyboard changed; a text change on the page does not need a new video.
