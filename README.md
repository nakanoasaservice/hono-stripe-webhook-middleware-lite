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

app.post("/webhook", stripeWebhookMiddleware(env.STRIPE_WEBHOOK_SECRET), async (c) => {
	const event = await c.req.json<Stripe.Event>();
	// event is verified — handle it
	return c.json({ received: true });
});

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

app.post("/webhook", stripeWebhookMiddleware(process.env.STRIPE_WEBHOOK_SECRET!), async (c) => {
	const event = await c.req.json<Stripe.Event>();
	return c.json({ received: true });
});

serve(app);
```

### Deno

```ts
import { Hono } from "hono";
import type Stripe from "stripe"; // types only — not bundled
import { stripeWebhookMiddleware } from "@nakanoaas/hono-stripe-webhook-middleware-lite";

const app = new Hono();

app.post("/webhook", stripeWebhookMiddleware(Deno.env.get("STRIPE_WEBHOOK_SECRET")!), async (c) => {
	const event = await c.req.json<Stripe.Event>();
	return c.json({ received: true });
});

Deno.serve(app.fetch);
```

### Bun

```ts
import { Hono } from "hono";
import type Stripe from "stripe"; // types only — not bundled
import { stripeWebhookMiddleware } from "@nakanoaas/hono-stripe-webhook-middleware-lite";

const app = new Hono();

app.post("/webhook", stripeWebhookMiddleware(process.env.STRIPE_WEBHOOK_SECRET!), async (c) => {
	const event = await c.req.json<Stripe.Event>();
	return c.json({ received: true });
});

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

## Debugging

When signature verification fails, the middleware throws an `HTTPException` with the underlying error attached as `cause`. You can inspect it in Hono's error handler:

```ts
import { HTTPException } from "hono/http-exception";

app.onError((error, c) => {
	if (error instanceof HTTPException) {
		console.error(error.cause);
		return error.getResponse();
	}
	// ...
});
```

Common causes include `SignatureVerificationError` with messages like `"Timestamp outside the tolerance zone"` or `"No signatures found matching the expected signature for payload"`.

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

## Already using the Stripe SDK?

If your project already depends on `stripe` at runtime (e.g. to create charges or manage subscriptions), adding this library won't reduce your bundle — it will only increase it. In that case, use our sister library **[hono-stripe-webhook-middleware](https://github.com/nakanoasaservice/hono-stripe-webhook-middleware)** instead, which delegates signature verification to the Stripe SDK you already ship.

## License

Apache-2.0

## Development

Use Node.js 24 and the pnpm version pinned in `package.json`.
Run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, and `pnpm build`.
Vite+ provides formatting, linting, type checks, tests and packaging. Tests
continue to run in the Cloudflare Workers runtime. Library builds retain
ESM, CommonJS, declaration files and source maps.

Update Vite+ and its bundled tools together with `vp migrate`, then update the
pinned `setup-vp` version in CI and refresh the pnpm lockfile. Run the project's
checks before committing toolchain updates.

### Runtime versions

`package.json` is the source of truth for development Node.js (`devEngines.runtime`)
and pnpm (`packageManager`). The major versions in `mise.toml` only bootstrap the
environment. Install the [global Vite+ CLI](https://viteplus.dev/guide/global-cli)
with environment management enabled, then use `vp install --frozen-lockfile`
and `vp run <script>` to run with the declared versions. `pnpm` commands also use
them when the Vite+ shims are active. The project-local CLI alone does not switch
Node.js versions.

CI reads the same manifest automatically; compatibility-test matrices explicitly
override Node.js. pnpm runtime management is disabled so it does not override
Vite+'s selection. Keep any consumer-facing `engines.node` support range separate
from the development pin.
