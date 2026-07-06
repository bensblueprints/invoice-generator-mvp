# Product Hunt Launch — Invoice Generator

## Name
Invoice Generator — self-hosted invoicing, pay once

## Tagline (60 chars)
Own your invoicing. $39 once instead of $19/mo forever.

## Description (260 chars)
Self-hosted invoicing for freelancers: clients, line items, tax & discounts, professional PDFs, public payment links, recurring billing, dashboard. Runs as a desktop app or on a $5 VPS. Your client data stays on your hardware. MIT source. Pay once, own it forever.

## Full description

Invoice Generator replaces a FreshBooks subscription with software you actually own.

Everything a freelancer or small studio needs to get paid:

- Clients and business profile (logo, tax ID, bank details on every invoice)
- Invoices with line items, tax %, discounts, notes, due dates, and configurable numbering
- Clean professional PDFs rendered server-side — no headless browser, instant
- Public share links: clients view and download the invoice, no account needed
- Draft / sent / paid statuses with overdue computed automatically
- Dashboard: outstanding total, paid this month, overdue list
- Recurring monthly invoices, optionally auto-emailed via your own SMTP
- Dark, modern UI (React + Tailwind + Framer Motion)

Two ways to run it: as a desktop app (double-click, offline, zero config) or self-hosted on any $5 VPS with Docker when clients need public links. Same code, same SQLite file.

No telemetry. No per-client limits. No monthly bill. MIT-licensed source on GitHub — the paid version is the convenience installer.

## Maker first comment

Hey PH 👋

I got tired of paying $19/mo to FreshBooks to keep a list of 12 clients and send maybe 6 invoices a month. That's $228/year for what is, honestly, a form, a PDF, and a cron job.

So I built the tool I wanted: everything I actually used in FreshBooks — clients, invoices, tax/discount math, a nice PDF with my logo, a link I can text to a client, recurring retainer invoices — running on my own machine. The desktop app needs zero setup; when I needed public invoice links I moved the same SQLite file to a $5 VPS and kept going.

The code is MIT on GitHub (it doubles as my portfolio, so be brutal). The $39 one-time buy is the packaged 1-click installer for people who don't want to touch a terminal.

Honest limitations: no online card payments built in (you put your bank/PayPal details in the payment instructions), email is bring-your-own SMTP, and multi-user/teams isn't a goal. It's for freelancers who invoice a handful of clients and are done renting software.

Happy to answer anything!

## Gallery shots (5)

1. **Dashboard, dark UI** — outstanding total, paid this month, overdue list with red badges; sidebar visible. Caption: "Know what's owed at a glance."
2. **Invoice editor** — line items with live totals panel (subtotal → discount → tax → total). Caption: "Qty × rate, tax and discount handled for you."
3. **Generated PDF** — the rendered A4 invoice with logo, status pill, items table and payment details. Caption: "Professional PDFs, no design work."
4. **Public invoice link** — the client-facing `/inv/…` page on a phone-width frame with the Download PDF button. Caption: "Send a link. Client pays. No login."
5. **Recurring templates** — monthly retainer template with 'auto-emails' tag and Run now button. Caption: "Retainers invoice themselves every month."
