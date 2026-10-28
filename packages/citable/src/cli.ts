// citable on the command line: the same checks as citable.flisk.si, run from your own machine or CI. No model, no
// account: the same responses always give the same score, so a score can gate a pull request the way a lint error does.
import { parseArgs } from "node:util";
import {
	type Check,
	checkSite,
	grade,
	type Report,
} from "../../../services/app/web/src/checks";
import {
	type Fetcher,
	normalizeTarget,
	safeFetch,
} from "../../../services/app/web/src/net";

export const VERSION = "0.1.0";

export const USAGE = `Usage: citable <url>... [options]

Checks whether AI answer engines (ChatGPT search, Claude, Perplexity, Google AI Overviews, Copilot) can crawl, read and
cite each page, and scores it out of 100. The same checks as https://citable.flisk.si.

Options:
  --min-score <n>   Exit 1 when a page scores below n (0-100)
  --skip <ids>      Leave checks out of the score, comma-separated (speed: response time varies between runs)
  --json            Print the reports as JSON
  --markdown        Print a Markdown table, for $GITHUB_STEP_SUMMARY
  --timeout <ms>    Time limit per request (8000)
  -v, --version     Print the version
  -h, --help        Print this help

Check ids: ai-crawlers, indexable, content, title, structured-data, headings, canonical, sitemap, llms-txt, speed

Exit codes: 0 every page passed, 1 a page scored below --min-score, 2 a page could not be read or the usage is wrong.`;

export interface Io {
	out(text: string): void;
	err(text: string): void;
	/** How pages are fetched; tests pass a fake one. */
	fetcher?: Fetcher;
	now?: Date;
}

const SCORED = [
	"ai-crawlers",
	"indexable",
	"content",
	"title",
	"structured-data",
	"headings",
	"canonical",
	"sitemap",
	"llms-txt",
	"speed",
];

/** The report without the skipped checks, scored out of 100 over the checks that are left. */
export function withoutChecks(report: Report, skip: Set<string>): Report {
	if (!skip.size || report.error) return report;
	const checks = report.checks.filter((c) => !skip.has(c.id));
	const max = checks.reduce((n, c) => n + c.max, 0);
	const points = checks.reduce((n, c) => n + c.points, 0);
	const score = max > 0 ? Math.round((100 * points) / max) : 0;
	return { ...report, checks, score, grade: grade(score) };
}

const glyph: Record<Check["status"], string> = {
	pass: "✓",
	warn: "!",
	fail: "✕",
	info: "i",
};

const pts = (c: Check) => (c.max ? `${Math.round(c.points)}/${c.max}` : "");

function text(report: Report): string {
	if (report.error)
		return `${report.url}: could not read the page: ${report.error}.`;
	const lines = [
		`${report.finalUrl}  ${report.score}/100 (grade ${report.grade})`,
	];
	if (report.partial)
		lines.push(
			`  Partial: the page answered ${report.partial}, so its contents were not checked.`,
		);
	const answers = report.crawlers.filter((c) => c.role === "answers");
	const blocked = answers.filter((c) => !c.allowed).map((c) => c.token);
	lines.push(
		`  Answer engines: ${answers.length - blocked.length} of ${answers.length} allowed${blocked.length ? ` (blocked: ${blocked.join(", ")})` : ""}`,
		"",
	);
	for (const c of report.checks) {
		lines.push(
			`  ${glyph[c.status]} ${c.title.padEnd(42)} ${pts(c).padStart(5)}  ${c.summary}`,
		);
		if (c.fix && (c.status === "fail" || c.status === "warn"))
			lines.push(`      Fix: ${c.fix.replace(/\n/g, "\n      ")}`);
	}
	return lines.join("\n");
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

function markdown(report: Report): string {
	if (report.error)
		return `### ${report.url}\n\nCould not read the page: ${cell(report.error)}.`;
	const lines = [
		`### ${report.finalUrl}: ${report.score}/100 (grade ${report.grade})`,
		"",
		"| | Check | Points | Result |",
		"| --- | --- | --- | --- |",
		...report.checks.map(
			(c) =>
				`| ${glyph[c.status]} | ${cell(c.title)} | ${pts(c)} | ${cell(c.summary)} |`,
		),
	];
	const fixes = report.checks.filter(
		(c) => c.fix && (c.status === "fail" || c.status === "warn"),
	);
	if (fixes.length)
		lines.push(
			"",
			"**How to fix**",
			"",
			...fixes.map((c) => `- **${cell(c.title)}**: ${cell(c.fix ?? "")}`),
		);
	return lines.join("\n");
}

/** Runs the command line; returns the exit code. */
export async function main(argv: string[], io: Io): Promise<number> {
	let args: ReturnType<typeof parse>;
	try {
		args = parse(argv);
	} catch (error) {
		io.err(`${(error as Error).message}\n\n${USAGE}`);
		return 2;
	}
	const { values, positionals } = args;
	if (values.help) {
		io.out(USAGE);
		return 0;
	}
	if (values.version) {
		io.out(VERSION);
		return 0;
	}
	const usage = (message: string) => {
		io.err(`${message}\n\n${USAGE}`);
		return 2;
	};
	if (!positionals.length) return usage("Give at least one address.");
	const minScore =
		values["min-score"] === undefined ? undefined : Number(values["min-score"]);
	if (minScore !== undefined && !(minScore >= 0 && minScore <= 100))
		return usage("--min-score takes a number from 0 to 100.");
	const timeoutMs =
		values.timeout === undefined ? 8000 : Number(values.timeout);
	if (!(timeoutMs > 0))
		return usage("--timeout takes a number of milliseconds.");
	const skip = new Set(
		(values.skip ?? "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
	);
	const unknown = [...skip].filter((id) => !SCORED.includes(id));
	if (unknown.length) return usage(`Unknown check id: ${unknown.join(", ")}.`);
	const targets = positionals.map((p) => [p, toUrl(p)] as const);
	const bad = targets.filter(([, url]) => !url).map(([p]) => p);
	if (bad.length) return usage(`Not a web address: ${bad.join(", ")}.`);

	// Direct: the CLI checks the user's own sites, localhost and staging included, so it skips the public-address check.
	const fetcher: Fetcher =
		io.fetcher ??
		((url, options) =>
			safeFetch(url, {
				...options,
				direct: true,
				...(values.timeout !== undefined && { timeoutMs }),
			}));
	const reports: Report[] = [];
	for (const [, url] of targets)
		reports.push(
			withoutChecks(await checkSite(url as URL, fetcher, io.now), skip),
		);

	if (values.json)
		io.out(
			JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2),
		);
	else
		io.out(
			reports
				.map(values.markdown ? markdown : text)
				.join(values.markdown ? "\n\n" : "\n\n"),
		);

	if (reports.some((r) => r.error)) return 2;
	if (minScore !== undefined) {
		const low = reports.filter((r) => r.score < minScore);
		for (const r of low)
			io.err(`${r.finalUrl} scored ${r.score}, below --min-score ${minScore}.`);
		if (low.length) return 1;
	}
	return 0;
}

/** A full http(s) address as given, localhost and ports included; anything shorter the way the website reads it. */
function toUrl(input: string): URL | undefined {
	if (!/^https?:\/\//i.test(input.trim())) return normalizeTarget(input);
	try {
		const url = new URL(input.trim());
		url.hash = "";
		return url;
	} catch {
		return undefined;
	}
}

function parse(argv: string[]) {
	return parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			"min-score": { type: "string" },
			skip: { type: "string" },
			json: { type: "boolean" },
			markdown: { type: "boolean" },
			timeout: { type: "string" },
			version: { type: "boolean", short: "v" },
			help: { type: "boolean", short: "h" },
		},
	});
}
