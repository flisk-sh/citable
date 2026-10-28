// Fetching pages from addresses that visitors type: only public hosts on ports 80 and 443, a few redirects, a time
// limit and a size limit. Every redirect hop is checked again, so a public page cannot bounce the checker into a
// private network. The address check runs before each request; a host that resolves to a public address for the check
// and to a private one a moment later (DNS rebinding) is the case it does not cover, which is why the checker only ever
// reads responses and never sends anything but GET.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const USER_AGENT = "CitableBot/1.0 (+https://citable.flisk.si/about)";

export interface Fetched {
	/** The URL asked for. */
	url: string;
	/** The URL that answered, after redirects. */
	finalUrl: string;
	status: number;
	headers: Record<string, string>;
	body: string;
	/** Milliseconds until the response headers arrived. */
	ms: number;
	/** Set when there was no HTTP answer at all: refused address, DNS failure, timeout. */
	error?: string;
}

export type Fetcher = (url: string, options?: FetchOptions) => Promise<Fetched>;

/** Whether an IP address belongs to a private, loopback, link-local, shared or otherwise non-public range. */
export function isPrivateAddress(address: string): boolean {
	const kind = isIP(address);
	if (kind === 4) {
		const [a, b] = address.split(".").map(Number);
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			a >= 224 ||
			(a === 100 && b >= 64 && b <= 127) ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			(a === 192 && b === 0 && Number(address.split(".")[2]) === 0) ||
			(a === 198 && (b === 18 || b === 19))
		);
	}
	if (kind === 6) {
		const v6 = address.toLowerCase();
		const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
		if (mapped) return isPrivateAddress(mapped[1]);
		return (
			v6 === "::" ||
			v6 === "::1" ||
			v6.startsWith("fc") ||
			v6.startsWith("fd") ||
			/^fe[89ab]/.test(v6) ||
			v6.startsWith("ff") ||
			v6.startsWith("64:ff9b:")
		);
	}
	return true;
}

/** Why a URL may not be fetched, or undefined when it may. Resolves the host name. */
export async function refusal(
	url: URL,
	resolve = lookup,
): Promise<string | undefined> {
	if (url.protocol !== "http:" && url.protocol !== "https:")
		return "only http and https addresses";
	if (url.port && url.port !== "80" && url.port !== "443")
		return "only ports 80 and 443";
	if (url.username || url.password) return "no credentials in the address";
	const host = url.hostname.replace(/^\[|\]$/g, "");
	if (isIP(host))
		return isPrivateAddress(host) ? "a private address" : undefined;
	if (
		!host.includes(".") ||
		/\.(localhost|local|internal|lan|home|corp|test)$/i.test(host)
	)
		return "not a public host";
	let addresses: { address: string }[];
	try {
		addresses = await resolve(host, { all: true });
	} catch {
		return "the host name does not resolve";
	}
	if (addresses.length === 0) return "the host name does not resolve";
	if (addresses.some((a) => isPrivateAddress(a.address)))
		return "the host resolves to a private address";
	return undefined;
}

export interface FetchOptions {
	timeoutMs?: number;
	maxBytes?: number;
	maxRedirects?: number;
}

/** Fetches with GET, following up to `maxRedirects` redirects by hand and checking each hop. Never throws. */
export async function safeFetch(
	url: string,
	options: FetchOptions = {},
): Promise<Fetched> {
	const { timeoutMs = 8000, maxBytes = 2_000_000, maxRedirects = 5 } = options;
	const started = Date.now();
	const failed = (error: string, finalUrl = url): Fetched => ({
		url,
		finalUrl,
		status: 0,
		headers: {},
		body: "",
		ms: Date.now() - started,
		error,
	});
	let current: URL;
	try {
		current = new URL(url);
	} catch {
		return failed("not a valid address");
	}
	const signal = AbortSignal.timeout(timeoutMs);
	for (let hop = 0; hop <= maxRedirects; hop++) {
		const refused = await refusal(current);
		if (refused) return failed(`refused: ${refused}`, current.href);
		let response: Response;
		try {
			response = await fetch(current, {
				redirect: "manual",
				signal,
				headers: {
					"user-agent": USER_AGENT,
					accept: "text/html,text/plain,application/xml;q=0.9,*/*;q=0.5",
				},
			});
		} catch (error) {
			const timedOut =
				(error as Error)?.name === "TimeoutError" || signal.aborted;
			return failed(
				timedOut
					? `no answer within ${timeoutMs / 1000} seconds`
					: "could not connect",
				current.href,
			);
		}
		const ms = Date.now() - started;
		const location = response.headers.get("location");
		if (response.status >= 300 && response.status < 400 && location) {
			await response.body?.cancel();
			try {
				current = new URL(location, current);
			} catch {
				return failed("a redirect to an invalid address", current.href);
			}
			continue;
		}
		const headers: Record<string, string> = {};
		response.headers.forEach((value, key) => {
			headers[key] = value;
		});
		let body: string;
		try {
			body = await readLimited(response, maxBytes);
		} catch {
			return failed(
				`no complete answer within ${timeoutMs / 1000} seconds`,
				current.href,
			);
		}
		return {
			url,
			finalUrl: current.href,
			status: response.status,
			headers,
			body,
			ms,
		};
	}
	return failed(`more than ${maxRedirects} redirects`, current.href);
}

async function readLimited(
	response: Response,
	maxBytes: number,
): Promise<string> {
	if (!response.body) return "";
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (total < maxBytes) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		total += value.byteLength;
	}
	if (total >= maxBytes) await reader.cancel();
	return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes));
}

/**
 * The site a visitor means, from what they typed or from the path after the domain:
 * `example.com`, `https://example.com/docs`, `example.com/docs`. Undefined when it is not a web address.
 */
export function normalizeTarget(input: string): URL | undefined {
	let text = input.trim();
	if (!text) return undefined;
	text = text.replace(/^(https?):\/(?!\/)/i, "$1://");
	if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
	let url: URL;
	try {
		url = new URL(text);
	} catch {
		return undefined;
	}
	if (!/^[a-z0-9.-]+$/i.test(url.hostname) && !url.hostname.startsWith("["))
		return undefined;
	if (!url.hostname.includes(".")) return undefined;
	url.hash = "";
	url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
	return url;
}
