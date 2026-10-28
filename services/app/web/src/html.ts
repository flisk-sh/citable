// What an AI crawler that does not run JavaScript sees in a page: the head tags, the headings, the structured data and
// how much readable text the server sent. Parsed with Bun's HTMLRewriter, a streaming parser, so a large page costs
// little memory.

export interface PageFacts {
	title: string;
	description: string;
	lang: string;
	canonical: string;
	metaRobots: string;
	h1: string[];
	h2Count: number;
	jsonLd: string[];
	og: Record<string, string>;
	/** Words of readable text outside scripts, styles and templates. */
	words: number;
	scripts: number;
}

// Scripts are skipped by their own handler: an element keeps only one end-tag handler, so two would overwrite each other.
const SKIPPED = "style, noscript, template, svg";

export async function readPage(html: string): Promise<PageFacts> {
	const facts: PageFacts = {
		title: "",
		description: "",
		lang: "",
		canonical: "",
		metaRobots: "",
		h1: [],
		h2Count: 0,
		jsonLd: [],
		og: {},
		words: 0,
		scripts: 0,
	};
	let skip = 0;
	let inTitle = false;
	let titleDone = false;
	let h1Depth = 0;
	let h1Text = "";
	let ld: string | undefined;
	const text: string[] = [];

	const rewriter = new HTMLRewriter()
		.on("html", {
			element(e) {
				facts.lang ||= e.getAttribute("lang") ?? "";
			},
		})
		.on("title", {
			element(e) {
				if (titleDone || skip > 0) return;
				inTitle = true;
				e.onEndTag(() => {
					inTitle = false;
					titleDone = true;
				});
			},
			text(t) {
				if (inTitle) facts.title += t.text;
			},
		})
		.on("meta", {
			element(e) {
				const name = (e.getAttribute("name") ?? "").toLowerCase();
				const property = (e.getAttribute("property") ?? "").toLowerCase();
				const content = e.getAttribute("content") ?? "";
				if (name === "description" && !facts.description)
					facts.description = content;
				if (name === "robots")
					facts.metaRobots = [facts.metaRobots, content]
						.filter(Boolean)
						.join(", ");
				if (property.startsWith("og:") && !(property in facts.og))
					facts.og[property] = content;
			},
		})
		.on("link", {
			element(e) {
				const rel = (e.getAttribute("rel") ?? "").toLowerCase().split(/\s+/);
				if (rel.includes("canonical") && !facts.canonical)
					facts.canonical = e.getAttribute("href") ?? "";
			},
		})
		.on("h1", {
			element(e) {
				h1Depth++;
				e.onEndTag(() => {
					h1Depth--;
					if (h1Depth === 0) {
						facts.h1.push(h1Text.replace(/\s+/g, " ").trim());
						h1Text = "";
					}
				});
			},
		})
		.on("h2", {
			element() {
				facts.h2Count++;
			},
		})
		.on("script", {
			element(e) {
				facts.scripts++;
				skip++;
				const isLd =
					(e.getAttribute("type") ?? "").toLowerCase() ===
					"application/ld+json";
				if (isLd) ld = "";
				e.onEndTag(() => {
					skip--;
					if (isLd && ld !== undefined) facts.jsonLd.push(ld);
					ld = undefined;
				});
			},
			text(t) {
				if (ld !== undefined) ld += t.text;
			},
		})
		.on(SKIPPED, {
			element(e) {
				skip++;
				e.onEndTag(() => {
					skip--;
				});
			},
		})
		.onDocument({
			text(t) {
				if (skip > 0 || inTitle) return;
				text.push(t.text);
				if (h1Depth > 0) h1Text += t.text;
			},
		});

	await rewriter.transform(new Response(html)).text();
	facts.title = decode(facts.title.replace(/\s+/g, " ").trim());
	facts.description = decode(facts.description.trim());
	facts.h1 = facts.h1.map(decode);
	facts.words = decode(text.join(" "))
		.split(/\s+/)
		.filter((w) => /\p{L}|\p{N}/u.test(w)).length;
	return facts;
}

const ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};

function decode(s: string): string {
	return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
		if (code[0] === "#") {
			const n =
				code[1] === "x" || code[1] === "X"
					? Number.parseInt(code.slice(2), 16)
					: Number(code.slice(1));
			return Number.isFinite(n) && n > 0 && n < 0x110000
				? String.fromCodePoint(n)
				: whole;
		}
		return ENTITIES[code.toLowerCase()] ?? whole;
	});
}

/** The schema.org types in a page's JSON-LD blocks, and how many blocks are not valid JSON. */
export function schemaTypes(blocks: string[]): {
	types: string[];
	invalid: number;
} {
	const types = new Set<string>();
	let invalid = 0;
	const visit = (node: unknown) => {
		if (Array.isArray(node)) {
			node.forEach(visit);
			return;
		}
		if (!node || typeof node !== "object") return;
		const record = node as Record<string, unknown>;
		const type = record["@type"];
		for (const t of Array.isArray(type) ? type : [type])
			if (typeof t === "string") types.add(t);
		if (record["@graph"]) visit(record["@graph"]);
	};
	for (const block of blocks) {
		try {
			visit(JSON.parse(block));
		} catch {
			invalid++;
		}
	}
	return { types: [...types], invalid };
}
