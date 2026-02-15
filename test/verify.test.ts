import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { importKeyFromWebhookSecret } from "../src/key.ts";
import { verifyHeader } from "../src/verify.ts";

const EVENT_PAYLOAD = {
	id: "evt_test_webhook",
	object: "event",
};
const EVENT_PAYLOAD_STRING = JSON.stringify(EVENT_PAYLOAD, null, 2);
const EVENT_PAYLOAD_BYTES = new TextEncoder().encode(EVENT_PAYLOAD_STRING);
const SECRET = "whsec_test_secret";

describe("validateSignature", async () => {
	const SECRET_KEY = await importKeyFromWebhookSecret(SECRET);

	it("should raise a SignatureVerificationError when the header does not have the expected format", async () => {
		const header = "I'm not even a real signature header";

		const expectedMessage =
			/Unable to extract timestamp and signatures from header/;

		await expect(
			verifyHeader(EVENT_PAYLOAD_BYTES, header, SECRET_KEY),
		).rejects.toThrow(expectedMessage);
	});

	it("should raise a SignatureVerificationError when the header is null or empty", async () => {
		const expectedMessage = /No stripe-signature header value was provided/;

		await expect(
			verifyHeader(EVENT_PAYLOAD_BYTES, "", SECRET_KEY),
		).rejects.toThrow(expectedMessage);

		await expect(
			verifyHeader(EVENT_PAYLOAD_BYTES, null as unknown as string, SECRET_KEY),
		).rejects.toThrow(expectedMessage);

		await expect(
			verifyHeader(
				EVENT_PAYLOAD_BYTES,
				undefined as unknown as string,
				SECRET_KEY,
			),
		).rejects.toThrow(expectedMessage);
	});

	it("should raise a SignatureVerificationError when there are no signatures with the expected scheme", async () => {
		const header = await Stripe.webhooks.generateTestHeaderStringAsync({
			secret: SECRET,
			payload: EVENT_PAYLOAD_STRING,
			scheme: "v0",
		});
		await expect(
			verifyHeader(EVENT_PAYLOAD_BYTES, header, SECRET_KEY),
		).rejects.toThrow(/No signatures found with expected scheme/);
	});

	it("should raise a SignatureVerificationError when there are no valid signatures for the payload", async () => {
		const header = await Stripe.webhooks.generateTestHeaderStringAsync({
			payload: EVENT_PAYLOAD_STRING,
			secret: SECRET,
			signature: "bad_signature",
		});

		await expect(
			verifyHeader(EVENT_PAYLOAD_BYTES, header, SECRET_KEY),
		).rejects.toThrow(
			/No signatures found matching the expected signature for payload/,
		);
	});

	it("should raise a SignatureVerificationError when the timestamp is not within the tolerance of the provided timestamp", async () => {
		const receivedAt = 20000000;
		const header = await Stripe.webhooks.generateTestHeaderStringAsync({
			timestamp: receivedAt / 1000 - 15,
			payload: EVENT_PAYLOAD_STRING,
			secret: SECRET,
		});

		await expect(
			verifyHeader(EVENT_PAYLOAD_BYTES, header, SECRET_KEY, 10, receivedAt),
		).rejects.toThrow(/Timestamp outside the tolerance zone/);
	});

	it("should raise a SignatureVerificationError when the timestamp is not within the tolerance of Date.now()", async () => {
		const header = await Stripe.webhooks.generateTestHeaderStringAsync({
			timestamp: Math.floor(Date.now() / 1000) - 15,
			payload: EVENT_PAYLOAD_STRING,
			secret: SECRET,
		});

		await expect(
			verifyHeader(EVENT_PAYLOAD_BYTES, header, SECRET_KEY, 10),
		).rejects.toThrow(/Timestamp outside the tolerance zone/);
	});

	it("should resolve when the header contains a valid signature and the timestamp is within the tolerance of Date.now()", async () => {
		const header = await Stripe.webhooks.generateTestHeaderStringAsync({
			timestamp: Math.floor(Date.now() / 1000),
			payload: EVENT_PAYLOAD_STRING,
			secret: SECRET,
		});

		await expect(
			verifyHeader(EVENT_PAYLOAD_BYTES, header, SECRET_KEY, 10),
		).resolves.toBeUndefined();
	});

	it("should resolve when the header contains a valid signature and the timestamp is within the tolerance of the provided timestamp", async () => {
		const receivedAt = 20000000;
		const header = await Stripe.webhooks.generateTestHeaderStringAsync({
			timestamp: receivedAt / 1000 - 9,
			payload: EVENT_PAYLOAD_STRING,
			secret: SECRET,
		});

		await expect(
			verifyHeader(EVENT_PAYLOAD_BYTES, header, SECRET_KEY, 10, receivedAt),
		).resolves.toBeUndefined();
	});

	it("should resolve when the header contains at least one valid signature", async () => {
		let header = await Stripe.webhooks.generateTestHeaderStringAsync({
			timestamp: Math.floor(Date.now() / 1000),
			payload: EVENT_PAYLOAD_STRING,
			secret: SECRET,
		});
		header += ",v1=potato";

		await expect(
			verifyHeader(EVENT_PAYLOAD_BYTES, header, SECRET_KEY, 10),
		).resolves.not.toThrow();
	});

	it("should raise a SignatureVerificationError when the header contains a valid signature and the timestamp is off but no tolerance is provided", async () => {
		// NOTE: In the original implementation, this test would pass without error.
		// However, to ensure the principle of least surprise, we now require that an error be thrown in this case.
		// See: https://github.com/stripe/stripe-node/blob/47cdb5eb972d00bd682aa9078e0cfdc1049f7226/test/Webhook.spec.ts#L368
		const header = await Stripe.webhooks.generateTestHeaderStringAsync({
			timestamp: 12345,
			payload: EVENT_PAYLOAD_STRING,
			secret: SECRET,
		});

		await expect(
			verifyHeader(EVENT_PAYLOAD_BYTES, header, SECRET_KEY),
		).rejects.toThrow(/Timestamp outside the tolerance zone/);
	});

	it("should accept Buffer instances for the payload", async () => {
		const header = await Stripe.webhooks.generateTestHeaderStringAsync({
			timestamp: Math.floor(Date.now() / 1000),
			payload: EVENT_PAYLOAD_STRING,
			secret: SECRET,
		});

		await expect(
			verifyHeader(Buffer.from(EVENT_PAYLOAD_STRING), header, SECRET_KEY, 10),
		).resolves.not.toThrow();
	});

	it("should raise a SignatureVerificationError when payload is of an unknown type", async () => {
		const header = await Stripe.webhooks.generateTestHeaderStringAsync({
			payload: EVENT_PAYLOAD_STRING,
			secret: SECRET,
		});

		await expect(
			verifyHeader({} as Uint8Array, header, SECRET_KEY),
		).rejects.toThrow(
			/Webhook payload must be provided as a string or a Buffer/,
		);
		await expect(
			verifyHeader(new Date() as unknown as Uint8Array, header, SECRET_KEY),
		).rejects.toThrow(
			/Webhook payload must be provided as a string or a Buffer/,
		);
	});
});
