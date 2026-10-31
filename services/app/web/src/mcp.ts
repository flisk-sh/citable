// A read-only MCP server over Streamable HTTP with one tool, check_site. Stateless and answered with plain JSON (no
// event stream), which the transport allows, so there is no session to keep.
import type { Report } from "./checks";
import { fixPrompt } from "./ui";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

interface JsonRpcRequest {
	jsonrpc?: string;
	id?: string | number | null;
	method?: string;
	params?: Record<string, unknown>;
}

export const CHECK_SITE_TOOL = {
	name: "check_site",
	title: "Check a site for AI search",
	description:
		"Checks whether AI answer engines (ChatGPT search, Claude, Perplexity, Google AI Overviews, Copilot) can crawl, read and cite a web page: robots.txt per crawler, noindex/nosnippet, text readable without JavaScript, title, headings, schema.org, canonical, sitemap, llms.txt, response time. Returns a 0-100 score and a fix for each problem.",
	inputSchema: {
		type: "object",
		properties: {
			url: {
				type: "string",
				description:
					"A domain or page address, for example example.com or https://example.com/pricing",
			},
		},
		required: ["url"],
	},
	annotations: {
		title: "Check a site for AI search",
		readOnlyHint: true,
		openWorldHint: true,
	},
};

export function summarize(report: Report): string {
	if (report.error) return `Could not read ${report.url}: ${report.error}.`;
	const lines = [
		`${report.finalUrl}: ${report.score}/100 (grade ${report.grade}) for AI search.`,
		"",
	];
	for (const c of report.checks) {
		lines.push(
			`[${c.status}] ${c.title}${c.max ? ` (${Math.round(c.points)}/${c.max})` : ""}: ${c.summary}`,
		);
		if (c.fix && c.status !== "pass")
			lines.push(`  Fix: ${c.fix.replace(/\n/g, "\n  ")}`);
	}
	return lines.join("\n");
}

export type CheckFn = (url: string) => Promise<Report | { error: string }>;

/** Answers one JSON-RPC message (or a batch); undefined when nothing is to be sent back (notifications). */
export async function handleMcp(
	body: unknown,
	check: CheckFn,
): Promise<unknown> {
	if (Array.isArray(body)) {
		const answers = (
			await Promise.all(body.map((m) => handleOne(m as JsonRpcRequest, check)))
		).filter((a) => a !== undefined);
		return answers.length ? answers : undefined;
	}
	return handleOne(body as JsonRpcRequest, check);
}

async function handleOne(
	message: JsonRpcRequest,
	check: CheckFn,
): Promise<unknown> {
	if (
		!message ||
		typeof message !== "object" ||
		typeof message.method !== "string"
	) {
		return {
			jsonrpc: "2.0",
			id: message?.id ?? null,
			error: { code: -32600, message: "Invalid request" },
		};
	}
	const { id, method, params } = message;
	if (id === undefined) return undefined;
	const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result });
	switch (method) {
		case "initialize": {
			const asked =
				typeof params?.protocolVersion === "string"
					? params.protocolVersion
					: "";
			return ok({
				protocolVersion: PROTOCOL_VERSIONS.includes(asked)
					? asked
					: PROTOCOL_VERSIONS[0],
				capabilities: { tools: {} },
				serverInfo: { name: "citable", version: "1.0.0" },
				instructions:
					"Use check_site when someone asks whether AI search or chatbots can find, read or cite a website.",
			});
		}
		case "ping":
			return ok({});
		case "tools/list":
			return ok({ tools: [CHECK_SITE_TOOL] });
		case "tools/call": {
			if (params?.name !== CHECK_SITE_TOOL.name) {
				return {
					jsonrpc: "2.0",
					id,
					error: {
						code: -32602,
						message: `Unknown tool: ${String(params?.name)}`,
					},
				};
			}
			const url = (params.arguments as Record<string, unknown> | undefined)
				?.url;
			if (typeof url !== "string" || !url.trim()) {
				return ok({
					content: [
						{ type: "text", text: "Give a url, for example example.com." },
					],
					isError: true,
				});
			}
			const report = await check(url);
			if (!("checks" in report))
				return ok({
					content: [{ type: "text", text: report.error }],
					isError: true,
				});
			const text = report.error
				? summarize(report)
				: `${summarize(report)}\n\n${fixPrompt(report)}`;
			return ok({
				content: [{ type: "text", text }],
				structuredContent: report,
				isError: Boolean(report.error),
			});
		}
		default:
			return {
				jsonrpc: "2.0",
				id,
				error: { code: -32601, message: `Method not found: ${method}` },
			};
	}
}
