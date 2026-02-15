import { readFile, writeFile } from "node:fs/promises";

import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "src/index.ts",
	format: ["cjs", "esm"],
	unbundle: true,
	exports: true,
	dts: true,
	sourcemap: true,
	clean: true,
	hooks: {
		"build:done": async () => {
			const packageJson = JSON.parse(
				await readFile("package.json", "utf-8"),
			) as {
				name: string;
				version: string;
				license: string;
				peerDependencies: {
					hono: string;
				};
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
							hono: `jsr:@hono/hono@${packageJson.peerDependencies.hono}`,
						},
					},
					null,
					2,
				),
			);
		},
	},
});
