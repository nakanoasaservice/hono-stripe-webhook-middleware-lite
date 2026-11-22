import { readFile, writeFile } from "node:fs/promises";

import { defineConfig } from "vite-plus";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
		}),
	],

	fmt: {
		useTabs: true,
		ignorePatterns: [
			"dist/**",
			".wrangler/**",
			"worker-configuration.d.ts",
			"jsr.jsonc",
			"pnpm-lock.yaml",
		],
	},
	lint: {
		options: { typeAware: true, typeCheck: true },
		ignorePatterns: ["dist/**", ".wrangler/**", "worker-configuration.d.ts"],
	},
	pack: {
		deps: {
			// tsdown <0.23 compatibility: resolve external dependency subpaths.
			// Remove to preserve subpath imports as written (the new default).
			// https://tsdown.dev/options/dependencies#deps-resolvedepsubpath
			resolveDepSubpath: true,
		},
		entry: "src/index.ts",
		format: ["cjs", "esm"],
		unbundle: true,
		exports: true,
		dts: true,
		sourcemap: true,
		clean: true,
		hooks: {
			"build:done": async () => {
				const packageJson = JSON.parse(await readFile("package.json", "utf-8")) as {
					name: string;
					version: string;
					license: string;
				};

				await writeFile(
					"jsr.jsonc",
					JSON.stringify(
						{
							name: packageJson.name,
							version: packageJson.version,
							license: packageJson.license,
							exports: "./src/index.ts",
							publish: {
								include: ["src", "README.md", "LICENSE"],
							},
							imports: {
								hono: `jsr:@hono/hono@^4.1.0`,
							},
						},
						null,
						2,
					),
				);
			},
		},
	},
});
