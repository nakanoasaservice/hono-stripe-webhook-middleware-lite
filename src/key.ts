import { encoder } from "./encoder";

export class WebhookSecretImportError extends Error {}

export async function importKeyFromWebhookSecret(
	webhookSecret: string,
): Promise<CryptoKey> {
	try {
		const keyBytes = encoder.encode(webhookSecret);

		return await crypto.subtle.importKey(
			"raw",
			keyBytes,
			{
				name: "HMAC",
				hash: { name: "SHA-256" },
			},
			false,
			["verify"],
		);
	} catch (cause: unknown) {
		throw new WebhookSecretImportError("Failed to import webhook secret", {
			cause,
		});
	}
}
