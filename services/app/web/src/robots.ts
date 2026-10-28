// robots.txt the way RFC 9309 reads it: a crawler follows the group naming its product token (or `*` when none does),
// and within the group the longest matching rule wins, with Allow winning a tie.

interface Rule {
	allow: boolean;
	pattern: string;
}

interface Group {
	agents: string[];
	rules: Rule[];
}

export interface Robots {
	groups: Group[];
	sitemaps: string[];
}

export function parseRobots(text: string): Robots {
	const groups: Group[] = [];
	const sitemaps: string[] = [];
	let current: Group | undefined;
	let lastWasAgent = false;
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.replace(/#.*$/, "").trim();
		const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
		if (!match) continue;
		const key = match[1].toLowerCase();
		const value = match[2].trim();
		if (key === "user-agent") {
			if (!current || !lastWasAgent) {
				current = { agents: [], rules: [] };
				groups.push(current);
			}
			current.agents.push(value.toLowerCase());
			lastWasAgent = true;
			continue;
		}
		if (key === "sitemap") {
			if (value) sitemaps.push(value);
			continue;
		}
		lastWasAgent = false;
		if (!current) continue;
		if (key === "allow" || key === "disallow") {
			// An empty Disallow allows everything: it is no rule at all.
			if (key === "disallow" && !value) continue;
			current.rules.push({ allow: key === "allow", pattern: value });
		}
	}
	return { groups, sitemaps };
}

/** The rules that apply to `token` (for example `GPTBot`): its own groups merged, else the `*` groups, else none. */
function rulesFor(
	robots: Robots,
	token: string,
): { rules: Rule[]; named: boolean } {
	const lower = token.toLowerCase();
	const own = robots.groups.filter((g) => g.agents.includes(lower));
	if (own.length > 0)
		return { rules: own.flatMap((g) => g.rules), named: true };
	return {
		rules: robots.groups
			.filter((g) => g.agents.includes("*"))
			.flatMap((g) => g.rules),
		named: false,
	};
}

function patternMatches(pattern: string, path: string): boolean {
	const anchored = pattern.endsWith("$");
	const body = anchored ? pattern.slice(0, -1) : pattern;
	const regex = body
		.split("*")
		.map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
		.join(".*");
	return new RegExp(`^${regex}${anchored ? "$" : ""}`).test(path);
}

export interface Verdict {
	allowed: boolean;
	/** Whether robots.txt names this crawler, rather than leaving it to the `*` group. */
	named: boolean;
	/** The rule that decided it, as written, when one did. */
	rule?: string;
}

/** Whether `token` may fetch `path` (a path with its query, starting with `/`). */
export function isAllowed(
	robots: Robots,
	token: string,
	path: string,
): Verdict {
	const { rules, named } = rulesFor(robots, token);
	let best: Rule | undefined;
	for (const rule of rules) {
		if (!patternMatches(rule.pattern, path)) continue;
		if (
			!best ||
			rule.pattern.length > best.pattern.length ||
			(rule.pattern.length === best.pattern.length && rule.allow && !best.allow)
		) {
			best = rule;
		}
	}
	if (!best) return { allowed: true, named };
	return {
		allowed: best.allow,
		named,
		rule: `${best.allow ? "Allow" : "Disallow"}: ${best.pattern}`,
	};
}
