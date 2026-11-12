// Writes the how-it-works clip from video.generated.ts to public/, where wrangler.toml's [assets] serves it.
// Run before `bunx wrangler@4 deploy` (the `deploy` script does both).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { VIDEO } from "../src/video.generated";

const out = join(import.meta.dir, "..", "public");
mkdirSync(out, { recursive: true });
for (const [name, file] of Object.entries(VIDEO)) {
	writeFileSync(join(out, name), Buffer.from(file.base64, "base64"));
	console.log(`public/${name}`);
}
