import { encoder } from "./encoder";

/**
 * Error thrown when the webhook secret cannot be imported as a {@link CryptoKey}.
 */
export class WebhookSecretImportError extends Error {}

/**
 * Imports a Stripe webhook secret string as a Web Crypto {@link CryptoKey}
 * suitable for HMAC-SHA256 signature verification.
 *
 * @param webhookSecret - The Stripe webhook signing secret (e.g. `"whsec_..."`)
 * @returns A {@link CryptoKey} configured for HMAC-SHA256 verification
 * @throws {@link WebhookSecretImportError} If the key import fails
 */
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
