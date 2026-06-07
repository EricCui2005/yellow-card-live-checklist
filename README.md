# Yellow Card Go-Live Review Packet

A reviewer-facing dashboard that auto-assembles a go-live sign-off packet from a customer's submitted launch plan and their sandbox transaction history.

This is an example project exploring an idea surfaced while reading the [Yellow Card](https://yellowcard.io) developer docs: the "Going Live" checklist requires a human reviewer to look at sandbox transaction evidence before issuing live credentials, but the artifact collection is currently manual. This project sketches what a self-serve dashboard for the **reviewer side** of that flow could look like — the page a Yellow Card engineer would open once a customer says "we're ready."

> [!IMPORTANT]
> **This is a demo built against mocked JSON fixtures.** A live deployment would query the customer's sandbox API (channels catalog + transaction history) using their sandbox credentials. The mocked-data disclaimer is rendered prominently at the top of every page so the demo can be evaluated end-to-end without a live sandbox connection.

## The idea

The customer uploads a JSON file declaring which transaction types they want to support — at coarse granularity:

```json
{
  "launchPlan": [
    { "country": "NG", "channelType": "bank", "direction": "send" },
    { "country": "UG", "channelType": "momo", "direction": "receive" },
    ...
  ]
}
```

The dashboard then:

1. **Resolves** each `(country, channelType, direction)` tuple against the channels catalog. One tuple can resolve to multiple channels (e.g. `ZA bank send` → both EFT and Automated Batched Payment), and each is checked independently. Tuples that resolve to nothing become "unresolved entries."
2. **Scours** the customer's sandbox transaction history for evidence of both success and failure cases on each resolved channel. A transaction counts as evidence only if its account number matches the [documented sandbox simulation patterns](https://docs.yellowcard.engineering/docs/sandbox-testing) (`1111111111` / `0000000000` for bank, `+{cc}1111111111` / `+{cc}0000000000` for mobile money). Without that, an integrator could call any random successful send "tested" — requiring the documented patterns means we're only counting transactions where the integrator clearly meant to exercise the simulation rail.
3. **Renders** a coverage matrix, integrator self-attestations (static IPs, key scope, top-up wallet, KYC tier plan), and an overall verdict.

The reviewer opens one URL and skims a pre-assembled packet instead of chasing Slack threads.

## Demo customers

Three states are accessible via the tab strip at the top of the page:

| Customer | Verdict | What it showcases |
|---|---|---|
| **Kondo Capital** (default) | `ready` | ZA-focused. `ZA bank send` resolves to two channels (EFT + Automated Batched). All cells covered. |
| **Westwind Payments** | `minor-gaps` | Pan-African momo network. 8 channels, 4 failure cells deliberately untested. No unresolved entries. |
| **Sunrise Remit** | `not-ready` | NG/UG/TZ coverage plus a `GH momo send` entry that has no matching channel in the catalog — surfaces the "unresolved entries" section. |

## Stack

- **Next.js 16** (App Router, Turbopack) with **React 19** — fully server-rendered, no client JS needed. Section collapsibility uses native `<details>/<summary>`.
- **Tailwind v4** for the build pipeline; styling is mostly inline CSS vars from `app/globals.css`.
- **Geist Sans + Geist Mono** via `next/font/google`, self-hosted at build time.
- **TypeScript** strict mode.
- **No backend.** Everything is read from JSON fixtures at build/request time.

## Running locally

```bash
npm install
npm run dev
# open http://localhost:3001
```

Switch between demo customers via the tabs, or directly:
- `http://localhost:3001/`
- `http://localhost:3001/?customer=sunrise`
- `http://localhost:3001/?customer=westwind`

## Project layout

```
app/
  layout.tsx          — root layout, font loading
  page.tsx            — single reviewer page; reads ?customer= from searchParams
  globals.css         — CSS variables for the dark + yellow palette
lib/
  types.ts            — Channel, LaunchPlanEntry, Submission, CoverageCellResult, ReviewPacket
  customers.ts        — fixture registry; getCustomer(id) → submission + transactions
  coverage.ts         — buildReviewPacket(customerId): resolves entries, scores cells, derives verdict
fixtures/
  channels.json       — the YC channels catalog (44 channels, from docs/channels-api.md)
  customers/
    kondo/            — submission.json + transactions.json (ready state)
    sunrise/          — submission.json + transactions.json (not-ready state)
    westwind/         — submission.json + transactions.json (minor-gaps state)
```

## Design notes

A few decisions worth calling out:

- **`channelId` is the only primitive.** The coverage matrix is keyed by `channelId`, and `country` / `channelType` / `direction` are derived from the channels lookup. The customer-facing submission file uses the coarse tuple because that's the mental model a customer has ("I want to support NG bank sends"); the resolution happens server-side.
- **One tuple → N rows.** When a submission entry resolves to multiple channels (`ZA bank send` is the demo case), each resolved channel becomes its own matrix row. Coverage is scored per channel, not per tuple.
- **What counts as evidence is strict.** Only transactions with the documented sandbox account-number patterns are credited. This trades a stricter "did they really test the failure path?" signal for the looser "did anything succeed?" signal. See `lib/coverage.ts → classifyOutcome`.
- **Verdict logic is intentionally simple.** Any unresolved entry → `not-ready`. Else any missing cell → `minor-gaps`. Else `ready`. Nothing fancier than that — the matrix itself surfaces the detail.
- **Section caveats are first-class.** The submission can carry `notesNotTested` per launch entry (e.g. "tested via MTN only, Airtel not exercised") and the matrix renders these inline under the relevant row.

## What's deliberately not modeled

- **Sub-network granularity.** A NG bank channel routes through multiple acquiring banks; this dashboard treats them as fungible. The `notesNotTested` field is the honest workaround for that.
- **`outboundTransactionType` for cross-border sends** (`ACH`, `WIRE`, `SWIFT`, `SEPA`, `FASTER_PAYMENTS`). Would need a routes layer on top of `(country, channelType, direction)`.
- **Crypto sandbox flows.** The wallet-address / sender-name patterns from the crypto sandbox docs aren't matched here.
- **Webhook / lifecycle-event coverage.** Whether the integrator has observed `EXPIRED`, `PENDING_LIQUIDITY`, etc. is a different evidence source (webhook delivery logs) and a separate panel.

Each of these is a natural extension — the data model and the matrix builder are written to make them additive rather than disruptive.
