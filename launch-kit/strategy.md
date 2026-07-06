# Launch Strategy — Invoice Generator

## Target communities

| Community | Angle (rules-aware) |
|---|---|
| r/freelance | Discussion post: "What do you actually use in FreshBooks?" → share the MIT repo when asked. No direct selling (strict). |
| r/selfhosted | "I built a self-hosted FreshBooks alternative (Node + SQLite, single container)" — this sub loves Docker one-liners; lead with compose file, not price. |
| r/smallbusiness | Value-first: cost breakdown of invoicing SaaS for a 5-client business; mention tool in comments only if asked (no self-promo in posts). |
| r/webdev / r/node | Show the build: "pdfkit instead of puppeteer for invoice PDFs — 10x smaller, here's the template code." Portfolio angle, link repo. |
| r/Entrepreneur | "Subscription fatigue" story post; the $228/yr → $39 math resonates. Check weekly self-promo thread. |
| Indie Hackers | Build-in-public post with revenue goal; IH allows direct product links. |
| Hacker News | Show HN (draft below). |

## Show HN draft

**Title:** Show HN: Self-hosted invoicing for freelancers – SQLite, pdfkit, one process

**Body:**
I freelanced for years paying FreshBooks $19/mo to invoice ~10 clients. The feature set I actually used fits in a weekend-scale app, so I built it: clients, invoices (qty×rate, tax %, discount), PDF generation, public share links, overdue tracking, and monthly recurring invoices.

Technical bits HN might find interesting:
- PDFs are rendered with pdfkit (pure JS) instead of headless Chromium — the whole Docker image stays small and invoice rendering is ~instant.
- Single Node process: Express serves the API, the built React app, and runs the recurring-invoice scheduler in-process. SQLite (WAL) via better-sqlite3.
- It ships both as a web app and as a thin Electron wrapper that boots the same Express server on a random local port — one codebase, `npm start` or `npm run desktop`. The annoying part was better-sqlite3's ABI differing between Node and Electron; solved with a prebuild swapper script.
- Public invoice links are unguessable 128-bit tokens; the admin area is one password + session cookie. Email is deliberately BYO-SMTP.

MIT source. The paid thing is just a packaged installer for non-technical folks. Feedback on the PDF template and the recurring scheduler design welcome.

## SEO keywords (10)

1. self hosted invoicing software
2. freshbooks alternative one time purchase
3. invoice generator for freelancers
4. open source invoice software
5. invoice app no subscription
6. recurring invoice software self hosted
7. invoice pdf generator with logo
8. small business invoicing without monthly fee
9. freelance invoice tracker
10. invoice ninja self hosted alternative

## AppSumo / PitchGround pitch

Invoice Generator is the anti-subscription invoicing tool for freelancers and micro-agencies. Everything they pay FreshBooks $19/mo for — client management, professional PDF invoices with their logo, shareable payment links, overdue tracking, and auto-recurring retainer billing — packaged as software they own outright and run on their own laptop or $5 VPS. Data lives in a local SQLite file (no vendor lock-in, trivially backed up), email goes through their own SMTP, and the MIT source is public so buyers can verify exactly what it does. Your audience of bootstrappers hates rent-seeking SaaS; a lifetime deal on a tool whose whole identity is "pay once, own forever" converts itself.

## Pricing

**Suggested: $39 one-time** (installer + updates), vs:
- FreshBooks Lite: $19/mo → **pays for itself in ~2 months** ($228/yr saved thereafter)
- Invoice Ninja hosted Pro: $12/mo → pays for itself in ~3.3 months
- Positioning floor: keep under $49 so it's an impulse "one FreshBooks month + change" decision.
- Launch promo: $29 first week (PH/HN traffic), then $39 list.
