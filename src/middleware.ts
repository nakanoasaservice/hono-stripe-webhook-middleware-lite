import { HTTPException } from "hono/http-exception";
import type { MiddlewareHandler } from "hono/types";

import { importKeyFromWebhookSecret } from "./key";
import { verifyHeader } from "./verify";

class StripeWebhookMiddlewareInitializationError extends Error {}

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
			throw new HTTPException(401, {
				message: "Missing stripe-signature header",
			});
		}

		const body = await c.req.text();

		try {
			await verifyHeader(body, header, await cryptoKey);
		} catch (cause: unknown) {
			throw new HTTPException(401, {
				message: "Stripe signature validation failed",
				cause: cause,
			});
		}

		await next();
	};
}
