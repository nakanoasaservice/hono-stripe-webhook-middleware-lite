import { HTTPException } from "hono/http-exception";
import type { MiddlewareHandler } from "hono/types";

import { importKeyFromWebhookSecret } from "./key";
import { verifyHeader } from "./verify";

class StripeWebhookMiddlewareInitializationError extends Error {}

/**
 * Creates a Hono middleware that verifies Stripe webhook signatures using the
 * Web Crypto API.
 *
 * The middleware validates the `stripe-signature` header on every incoming
 * request and throws an `HTTPException` (401) when the signature is missing or
 * invalid. The crypto key is derived once at initialization time and reused
 * across requests.
 *
 * @param webhookSecret - The Stripe webhook signing secret (must match
 *   `whsec_[a-zA-Z0-9]+`)
 * @returns A Hono {@link MiddlewareHandler}
 * @throws {@link StripeWebhookMiddlewareInitializationError} If the secret
 *   format is invalid
 *
 * @example
 * ```ts
 * import { Hono } from "hono";
 * import { env } from "cloudflare:workers";
 * import Stripe from "stripe";
 * import { stripeWebhookMiddleware } from "@nakanoaas/hono-stripe-webhook-middleware-lite";
 *
 * const app = new Hono();
 *
 * app.post(
 *   "/webhook",
 *   stripeWebhookMiddleware(env.STRIPE_WEBHOOK_SECRET),
 *   async (c) => {
 *     const event = await c.req.json<Stripe.Event>();
 *     // handle the verified Stripe event
 *     return c.json({ received: true });
 *   },
 * );
 * ```
 */
export function stripeWebhookMiddleware(
	webhookSecret: string,
): MiddlewareHandler {
	if (!/^whsec_[a-zA-Z0-9]+$/.test(webhookSecret)) {
		throw new StripeWebhookMiddlewareInitializationError(
			"The provided signing secret is not a valid webhook secret",
		);
	}

	const cryptoKey = importKeyFromWebhookSecret(webhookSecret);

	return async (c, next) => {
		const header = c.req.header("stripe-signature");
		if (!header) {
			throw new HTTPException(400, {
				message: "Missing stripe-signature header",
			});
		}

		const body = await c.req.text();

		try {
			await verifyHeader(body, header, await cryptoKey);
		} catch (cause: unknown) {
			throw new HTTPException(400, {
				message: "Stripe signature validation failed",
				cause: cause,
			});
		}

		await next();
	};
}
