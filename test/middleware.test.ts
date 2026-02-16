import { Hono } from "hono";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import { stripeWebhookMiddleware } from "../src/middleware.ts";

const EVENT_PAYLOAD = {
	id: "evt_test_webhook",
	object: "event",
};
const EVENT_PAYLOAD_STRING = JSON.stringify(EVENT_PAYLOAD, null, 2);
const EVENT_PAYLOAD_BYTES = new TextEncoder().encode(EVENT_PAYLOAD_STRING);
const SECRET = "whsec_test";

describe("stripeWebhookMiddleware", () => {
	it("should raise when the webhook secret is missing", async () => {
		const message = /The provided signing secret is not a valid webhook secret/;
		expect(() => stripeWebhookMiddleware("")).toThrow(message);
		expect(() => stripeWebhookMiddleware(null as unknown as string)).toThrow(
			message,
		);
		expect(() =>
			stripeWebhookMiddleware(undefined as unknown as string),
		).toThrow(message);
	});

	it("should raise when the webhook secret is invalid", async () => {
		expect(() => stripeWebhookMiddleware("invalid")).toThrow(
			/The provided signing secret is not a valid webhook secret/,
		);
	});

	it("should return function when the webhook secret is valid", async () => {
		const middleware = stripeWebhookMiddleware(SECRET);
		expect(middleware).toBeInstanceOf(Function);
	});

	it("should 400 when the webhook signature is missing", async () => {
		const mockFn = vi.fn();

		const app = new Hono().post("/", stripeWebhookMiddleware(SECRET), (c) => {
			mockFn(c);
			return c.body(null, 200);
		});

		const response = await app.request("/", {
			method: "POST",
			body: EVENT_PAYLOAD_BYTES,
		});
		expect(response.status).toBe(400);
		expect(mockFn).not.toHaveBeenCalled();
	});

	it("should 400 when the webhook signature is invalid", async () => {
		const mockFn = vi.fn();

		const header = await Stripe.webhooks.generateTestHeaderStringAsync({
			payload: EVENT_PAYLOAD_STRING,
			secret: SECRET,
			signature: "bad_signature",
		});

		const app = new Hono().post("/", stripeWebhookMiddleware(SECRET), (c) => {
			mockFn(c);
			return c.body(null, 200);
		});

		const response = await app.request("/", {
			method: "POST",
			headers: {
				"stripe-signature": header,
			},
			body: EVENT_PAYLOAD_BYTES,
		});
		expect(response.status).toBe(400);
		expect(mockFn).not.toHaveBeenCalled();
	});

	it("should 200 when the webhook signature is valid", async () => {
		const header = await Stripe.webhooks.generateTestHeaderStringAsync({
			payload: EVENT_PAYLOAD_STRING,
			secret: SECRET,
		});

		const app = new Hono().post("/", stripeWebhookMiddleware(SECRET), (c) =>
			c.body(null, 200),
		);

		const response = await app.request("/", {
			method: "POST",
			headers: {
				"stripe-signature": header,
			},
			body: EVENT_PAYLOAD_BYTES,
		});

		expect(response.status).toBe(200);
	});
});
