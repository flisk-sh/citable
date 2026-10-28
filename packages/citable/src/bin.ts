#!/usr/bin/env node
import { main } from "./cli";
import { installRewriter } from "./rewriter";

installRewriter();
process.exitCode = await main(process.argv.slice(2), {
	out: (text) => process.stdout.write(`${text}\n`),
	err: (text) => process.stderr.write(`${text}\n`),
});
