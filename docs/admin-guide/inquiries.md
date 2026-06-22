# Working inquiries (superadmin guide)

## Where leads come from
Every "Inquire" button on the public site — on a work's page, an artist's page, and the contact
modal — sends here. Per-work inquiries are tagged source **artwork** and linked to the piece; the
rest are **contact**. Nothing is emailed yet (see "Turn on email"), so this inbox is the system of
record — check it regularly.

## Working a lead
Open `/admin/inquiries`. Each row shows who, which work, and the status. Open one to read the full
message. Use the **Status** dropdown to move it through the pipeline:

- **new** — just arrived, not yet actioned.
- **contacted** — you've replied / reached out.
- **won** — resulted in a sale or confirmed acquisition.
- **lost** — went cold or declined.
- **archived** — filed away (spam, duplicate, resolved).

Add private **internal notes** for context; the collector never sees these. Use the checkboxes on the
list + **Mark contacted / Archive** to update several at once.

## Replying
Click **Reply by email** — it opens your normal mail app with the collector's address and a subject
pre-filled. Send from there, then set the status to **contacted**.

## Spam protection
A hidden honeypot field plus a per-visitor rate limit block most bots automatically. Genuine junk that
slips through: select it and **Archive** (or **Delete** from the detail page).

## Turn on email (optional, later)
To get an alert the moment an inquiry arrives — and send the collector an automatic acknowledgement —
add a `RESEND_API_KEY` environment variable in Vercel and verify your sending domain in Resend. Until
then the inbox works exactly the same, just without the email notifications.
