import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// Paystack webhook receiver. Events reach RoomBook via the shared Webjockeys
// gateway (thewebjockeys.co.za/api/paystack/webhook), which verifies + routes
// by `metadata.platform` and forwards the RAW body + signature here. We
// re-verify the HMAC ourselves, and ACK (200) events that aren't ours — the
// gateway broadcasts metadata-less lifecycle events to every product, so a
// non-200 here would make the gateway report failure and Paystack retry forever.
async function verifyPaystackSignature(
  rawBody: string,
  signature: string | null
): Promise<boolean> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody)
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

const paystackWebhook = httpAction(async (ctx, request) => {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!(await verifyPaystackSignature(rawBody, signature))) {
    return new Response(JSON.stringify({ ok: false, error: "invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let event: { event?: string };
  try {
    event = JSON.parse(rawBody) as { event?: string };
  } catch {
    return new Response(JSON.stringify({ ok: true, ignored: "unparseable" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Dedupe + apply happen in one transactional mutation. `signature` is the
  // idempotency key (identical across Paystack's retries of the same event).
  await ctx.runMutation(internal.paystackInternal.handleEvent, {
    dedupeKey: signature as string,
    eventType: event.event ?? "unknown",
    payload: event,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

http.route({ path: "/paystack/webhook", method: "POST", handler: paystackWebhook });

// Paystack sends a GET to confirm the endpoint is reachable.
http.route({
  path: "/paystack/webhook",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ ok: true, service: "roombook-paystack" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
