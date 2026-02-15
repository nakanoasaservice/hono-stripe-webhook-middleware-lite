import { encoder } from "./encoder";

export class SignatureVerificationError extends Error {}

export async function verifyHeader(
	payload: string | BufferSource,
	signatureHeader: string,
	key: CryptoKey,
	tolerance: number = 300,
	receivedAt: number = Date.now(),
): Promise<void> {
	const parsedHeader = parseHeader(signatureHeader, "v1");

	const timestampAge = Math.floor(receivedAt / 1000) - parsedHeader.timestamp;
	if (timestampAge > tolerance) {
		throw new SignatureVerificationError(
			"Timestamp outside the tolerance zone",
		);
	}

	const messageBytes = encoder.encode(
		`${parsedHeader.timestamp}.${
			typeof payload === "string" ? payload : decodePayload(payload)
		}`,
	);

	for (const sig of parsedHeader.signatures) {
		const sigBytes = new Uint8Array(
			sig.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
		);
		const isValid = await crypto.subtle.verify(
			"HMAC",
			key,
			sigBytes,
			messageBytes,
		);
		if (isValid) return;
	}

	throw new SignatureVerificationError(
		"No signatures found matching the expected signature for payload",
	);
}

type WebhookParsedHeader = {
	signatures: string[];
	timestamp: number;
};

function parseHeader(header: string, scheme: string): WebhookParsedHeader {
	if (!header) {
		throw new SignatureVerificationError(
			"No stripe-signature header value was provided",
		);
	}

	const parsedHeader = header.split(",").reduce<WebhookParsedHeader>(
		(accum, item) => {
			const [k, v] = item.split("=") as [string, string];

			if (k === "t") {
				accum.timestamp = parseInt(v, 10);
			}

			if (k === scheme) {
				accum.signatures.push(v);
			}

			return accum;
		},
		{
			timestamp: -1,
			signatures: [],
		},
	);

	if (parsedHeader.timestamp === -1) {
		throw new SignatureVerificationError(
			"Unable to extract timestamp and signatures from header",
		);
	}

	if (!parsedHeader.signatures.length) {
		throw new SignatureVerificationError(
			"No signatures found with expected scheme",
		);
	}

	return parsedHeader;
}

const decoder = new TextDecoder();
function decodePayload(payload: BufferSource): string {
	try {
		return decoder.decode(payload);
	} catch (cause) {
		throw new SignatureVerificationError(
			"Webhook payload must be provided as a string or a Buffer",
			{ cause },
		);
	}
}
