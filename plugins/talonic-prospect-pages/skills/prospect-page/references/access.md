# Read-access checklists

Use these for the "Exactly what we need for read access" section. Only include systems the prospect named. If a system is not listed here, write the generic checklist at the bottom and ask the sender to confirm the specifics with the prospect's admin. Never invent menu paths or product-specific names.

## AFAS Profit (Dutch ERP, AFAS Online)

Owner: usually the finance or AFAS admin.

1. **Environment number.** The 5-digit number in their AFAS Online address.
2. **An App Connector** named "Talonic read-only", created in Profit.
3. **GetConnectors only** in that connector, for the data in scope (for a revenue pilot: sales invoices with lines, projects, hour entries, expense claims, debtors, rate agreements, partner rebates). No UpdateConnectors, so nothing can be written. We send the exact field list beforehand.
4. **A dedicated user** linked to the connector, with access limited to that data.
5. **The token** for that user, shared through a secure link, never in plain email.

Note line: "Our connector calls the AFAS REST API over HTTPS. No VPN, no install and no change to your Profit setup."

Not to be confused with abas (German ERP) or Avast. Transcripts often mishear AFAS as "Avast" or "abas".

## DocuSign (eSignature)

Owner: usually legal or whoever administers DocuSign.

1. **Account ID and region**, shown under Settings › Apps and Keys.
2. **A dedicated user** for Talonic, with a permission profile that can view envelopes but not send them.
3. **Shared access** for that user to view the envelopes in scope. Otherwise it only sees its own.
4. **One-time consent** for the Talonic integration on that user. We send the consent link.
5. **The date range** to include, for example contracts active since 2023.

Note line: "DocuSign has no read-only API scope. Read-only comes from the user's view-only permissions, and our connector only reads. If a new user isn't possible, a one-off export of completed contract PDFs to a secure folder works too."

Open points to flag to the sender: the dedicated user may cost the prospect a DocuSign seat, and consent only works once Talonic's DocuSign integration is approved for production.

## Any other system (generic)

1. **A dedicated read-only user** for Talonic, limited to the data in scope.
2. **API credentials or an export** for that user, shared through a secure link.
3. **The data in scope**, which we list beforehand.

Note line: "Our connector only reads. No install and no change to your setup." Tell the sender which specifics (API, auth, network access) still need confirming with the prospect's admin.
