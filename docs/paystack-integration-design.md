# Paystack Subscription Billing — Integration Design

Status: design ready, not yet implemented. Target: Next.js 16 + Convex Cloud, ZAR.
Replaces/augments the current manual-EFT + super-admin-approve subscription flow.

## Why this shape
Tier ids in `src/lib/tiers.ts` are `basic|professional|enterprise` (Starter/Pro/Enterprise),
prices already in **cents** (14900/39900/79900). Paystack plan `amount` is also in cents for
ZAR — so tier→plan amount maps 1:1 with no conversion.

## Architecture decision
Webhook = a Convex `httpAction` in `convex/http.ts` (NOT a Next.js route), because Convex is the
source of truth for `organizations.status`; the httpAction writes state directly via `ctx.runMutation`,
gets the raw body for HMAC via `request.text()`, and the default Convex runtime already supports
`fetch` + Web Crypto (so no `"use node"`).

**Webhook URL to register in Paystack** = the Convex deployment's `.convex.site` host (already in env as
`NEXT_PUBLIC_CONVEX_SITE_URL`), path `/paystack/webhook`. For the current dev deployment:
`https://fearless-salmon-983.eu-west-1.convex.site/paystack/webhook`. (`.convex.site` = httpActions;
`.convex.cloud` = query/mutation transport.)

## Schema additions (all optional/additive — non-breaking on live data)
`organizations`: widen `paymentMethod` to `"eft"|"paystack"`; add `paystackCustomerCode`,
`paystackSubscriptionCode`, `paystackEmailToken`, `paystackPlanCode`, `paystackAuthorizationCode`,
`subscriptionStatus` (`active|non-renewing|attention|cancelled|none`), `currentPeriodEnd` (ms),
`graceUntil` (ms).
New `paystackEvents` table (idempotency): `{ dedupeKey (=x-paystack-signature hex), eventType, orgId?,
payload, processedAt }` index `by_dedupeKey`.
Optional `payments` table (billing history): `{ orgId, reference, paystackTxId?, amount, currency,
status, paidAt?, tier? }` indexes `by_org`, `by_reference`.

## Subscribe flow
1. `/subscribe`: primary CTA "Pay with card" → public Convex action `paystack.startCheckout({orgId, tier})`
   (owner-authed via `requireOwner`). Server derives amount/plan (never from client), reuses/creates the
   Paystack customer, generates a unique `reference` (include orgId), calls `POST /transaction/initialize`
   with `{email, plan: planCodeFor(tier), reference, callback_url, currency:"ZAR", channels:["card"],
   metadata:{orgId,tier}}`, returns `authorization_url`.
2. Client redirects to `authorization_url` (Paystack-hosted checkout — no public key needed).
3. Paystack → `callback_url` (`/subscribe/callback`) shows "Verifying…" (UX only; may call a server-side
   `verifyTransaction`). **Never activate from the client.**
4. **Webhook** (`charge.success` + `subscription.create`) activates: `status=active`, `subscriptionTier=tier`,
   `paymentMethod=paystack`, stores customer/subscription/email-token/plan codes, `subscriptionStatus=active`,
   `currentPeriodEnd=next_payment_date`.
   Event→org match priority: `metadata.orgId` → `paystackSubscriptionCode` → `paystackCustomerCode`
   (stored at startCheckout, so `subscription.create` always matches).

## Renewal / failure
- Renewal `charge.success` (no metadata) → match by customer/sub code; advance `currentPeriodEnd` monotonically.
- `invoice.payment_failed` → `subscriptionStatus=attention`, `graceUntil=now+N days`, email owner a manage/
  update-card link (`GET /subscription/:code/manage/link`). Paystack does **not** auto-retry.
- New daily cron in `convex/crons.ts`: orgs with `attention` and `graceUntil<now` → `status=suspended`
  (optionally re-charge stored authorization first). Suspension is already enforced server-side
  (rooms/invoice-generate throw when suspended); confirm booking-create honors it too.
- `subscription.disable` → `status=suspended` (guard against stale sub codes so a late duplicate can't
  clobber a re-subscribed org).

## Security / idempotency
Verify `x-paystack-signature` = HMAC-SHA512(raw body, SECRET key), hex, constant-time compare; hash BEFORE
JSON.parse; return 200 on success, 401 on bad signature. Dedupe on the signature hex in a single transactional
mutation (insert event row + apply state change together) → exactly-once under retries (Paystack retries ~72h).
Make handlers idempotent + monotonic. Secret key server-only (Convex env), never `NEXT_PUBLIC_*`.

## Env vars
- **Convex deployment env** (`npx convex env set` on the VPS, or dashboard — SEPARATE from `.env.local`):
  `PAYSTACK_SECRET_KEY` (sk_test→sk_live), `PAYSTACK_PLAN_BASIC/PROFESSIONAL/ENTERPRISE` (PLN_ codes).
- **`.env.local` / VPS**: `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` (only needed for inline Popup; redirect flow doesn't need it).
No separate webhook secret — webhooks are signed with the secret key.

## What the USER must do (I can't create the account or handle live keys)
1. Create a Paystack account (SA business), complete verification for live mode, set ZAR settlement bank.
2. Copy TEST keys (sk_test / pk_test).
3. Put `PAYSTACK_SECRET_KEY` in Convex env, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` in `.env.local` (I never see the values).
4. Create 3 monthly ZAR plans (R149/R399/R799) — via a one-time `paystack.provisionPlans` internalAction run
   from the Convex dashboard, or by hand. Put the PLN_ codes in Convex env.
5. Register the TEST webhook URL (above) in Paystack.
6. Test with Paystack test cards (success + decline); watch Convex logs + paystackEvents/payments.
7. Go live: swap to live keys, create live plans, register live webhook, one small real-card smoke test + refund.

## File change list
New: `convex/paystack.ts` (actions + internal mutations/queries), `convex/paystackWebhook.ts` (httpAction),
`src/lib/paystack.ts` (tier→plan mapping, types), `src/app/subscribe/callback/page.tsx`, optional billing UI
under settings.
Edit: `convex/schema.ts`, `convex/http.ts` (mount webhook), `convex/crons.ts` (dunning sweep),
`convex/organizations.ts` (cancel + suspend-also-disables-Paystack), `src/app/subscribe/page.tsx`,
`src/app/(dashboard)/admin/page.tsx`, `.env.example`.

## Open decisions (defaults I'll use unless overridden)
1. Paystack-managed Subscriptions + our own dunning cron (recommended). 
2. Monthly only (add annual later).
3. Upgrade/downgrade: no proration in Paystack → default "switch at period end" (not_renew old, start new at renewal).
4. Enterprise white-label on lapse: serve a "billing past due" page, retain domain through grace.
5. Grace period: 5 days, no auto-retry before suspend (configurable).
6. Checkout: hosted redirect (no public key).
7. Keep EFT as a secondary fallback + manual override.

Sources: paystack.com/docs (subscriptions, plan/subscription/transaction APIs, webhooks HMAC-SHA512).
