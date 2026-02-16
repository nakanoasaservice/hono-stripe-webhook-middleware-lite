# hono-stripe-webhook-middleware-lite

Stripe webhook verification for [Hono](https://hono.dev) — **without the Stripe SDK**.

[![npm](https://img.shields.io/npm/v/@nakanoaas/hono-stripe-webhook-middleware-lite)](https://www.npmjs.com/package/@nakanoaas/hono-stripe-webhook-middleware-lite)
[![JSR](https://jsr.io/badges/@nakanoaas/hono-stripe-webhook-middleware-lite)](https://jsr.io/@nakanoaas/hono-stripe-webhook-middleware-lite)
[![License](https://img.shields.io/github/license/nakanoasaservice/hono-stripe-webhook-middleware-lite)](LICENSE)

## Why?

If you only **receive** Stripe webhooks but never **call** the Stripe API, there is no reason to ship the entire `stripe` package. This library gives you production-ready webhook signature verification with **zero runtime dependencies** on the Stripe SDK, resulting in a drastically smaller bundle — perfect for edge and serverless environments.

- **No Stripe SDK** — The only peer dependency is Hono itself. Your bundle stays tiny.
- **Web Standards** — Built on the Web Crypto API (`crypto.subtle`), so it runs on **any** runtime: Cloudflare Workers, Node.js, Deno, Bun.
- **Secure** — Signature verification logic is ported from the official Stripe SDK and tested against the same test vectors.

## Install

```sh
# npm
npm install @nakanoaas/hono-stripe-webhook-middleware-lite

# pnpm
pnpm add @nakanoaas/hono-stripe-webhook-middleware-lite

# yarn
yarn add @nakanoaas/hono-stripe-webhook-middleware-lite

# bun
bun add @nakanoaas/hono-stripe-webhook-middleware-lite
```

For Deno via JSR:

```sh
deno add jsr:@nakanoaas/hono-stripe-webhook-middleware-lite
```

## Quick Start (Cloudflare Workers)

```ts
import { Hono } from "hono";
import { env } from "cloudflare:workers";
import type Stripe from "stripe"; // types only — not bundled
import { stripeWebhookMiddleware } from "@nakanoaas/hono-stripe-webhook-middleware-lite";

const app = new Hono();

app.post(
  "/webhook",
  stripeWebhookMiddleware(env.STRIPE_WEBHOOK_SECRET),
  async (c) => {
    const event = await c.req.json<Stripe.Event>();
    // event is verified — handle it
    return c.json({ received: true });
  },
);

export default app;
```

## Runtime Examples

### Node.js

```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type Stripe from "stripe"; // types only — not bundled
import { stripeWebhookMiddleware } from "@nakanoaas/hono-stripe-webhook-middleware-lite";

const app = new Hono();

app.post(
  "/webhook",
  stripeWebhookMiddleware(process.env.STRIPE_WEBHOOK_SECRET!),
  async (c) => {
    const event = await c.req.json<Stripe.Event>();
    return c.json({ received: true });
  },
);

serve(app);
```

### Deno

```ts
import { Hono } from "hono";
import type Stripe from "stripe"; // types only — not bundled
import { stripeWebhookMiddleware } from "@nakanoaas/hono-stripe-webhook-middleware-lite";

const app = new Hono();

app.post(
  "/webhook",
  stripeWebhookMiddleware(Deno.env.get("STRIPE_WEBHOOK_SECRET")!),
  async (c) => {
    const event = await c.req.json<Stripe.Event>();
    return c.json({ received: true });
  },
);

Deno.serve(app.fetch);
```

### Bun

```ts
import { Hono } from "hono";
import type Stripe from "stripe"; // types only — not bundled
import { stripeWebhookMiddleware } from "@nakanoaas/hono-stripe-webhook-middleware-lite";

const app = new Hono();

app.post(
  "/webhook",
  stripeWebhookMiddleware(process.env.STRIPE_WEBHOOK_SECRET!),
  async (c) => {
    const event = await c.req.json<Stripe.Event>();
    return c.json({ received: true });
  },
);

export default app;
```

## Dynamic Configuration

If you need to resolve the webhook secret at request time (e.g. from `c.env`), you can apply the middleware dynamically — the same pattern used by Hono's built-in JWT middleware:

```ts
import { Hono } from "hono";
import { stripeWebhookMiddleware } from "@nakanoaas/hono-stripe-webhook-middleware-lite";

type Env = { Bindings: { STRIPE_WEBHOOK_SECRET: string } };

const app = new Hono<Env>();

app.use("/webhook/*", (c, next) => {
  const middleware = stripeWebhookMiddleware(c.env.STRIPE_WEBHOOK_SECRET);
  return middleware(c, next);
});
```

## Advanced: Using without Hono

The core verification functions are framework-agnostic. You can use `verifyHeader` and `importKeyFromWebhookSecret` directly with any framework or runtime that supports the Web Crypto API:

```ts
import type Stripe from "stripe"; // types only — not bundled
import {
  importKeyFromWebhookSecret,
  verifyHeader,
} from "@nakanoaas/hono-stripe-webhook-middleware-lite";

const key = await importKeyFromWebhookSecret(process.env.STRIPE_WEBHOOK_SECRET!);

export async function handleWebhook(req: Request): Promise<Response> {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 401 });
  }

  const body = await req.text();

  try {
    await verifyHeader(body, signature, key);
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  const event: Stripe.Event = JSON.parse(body);
  // handle the verified event
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

## API

### `stripeWebhookMiddleware(webhookSecret)`

Creates a Hono middleware that verifies the `stripe-signature` header on every request. Returns `401` if the signature is missing or invalid.

- `webhookSecret` — Your Stripe webhook signing secret (`whsec_...`).

### `verifyHeader(payload, signatureHeader, key, tolerance?, receivedAt?)`

Lower-level function for manual signature verification.

- `payload` — The raw request body (`string` or `BufferSource`).
- `signatureHeader` — The `stripe-signature` header value.
- `key` — A `CryptoKey` from `importKeyFromWebhookSecret()`.
- `tolerance` — Max allowed timestamp age in seconds (default: `300`).
- `receivedAt` — Time the request was received in ms (default: `Date.now()`).

### `importKeyFromWebhookSecret(webhookSecret)`

Imports a Stripe webhook secret as a Web Crypto `CryptoKey` for HMAC-SHA256 verification.

## License

Apache-2.0
