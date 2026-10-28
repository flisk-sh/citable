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
		const h = hextets(address);
		if (!h) return true;
		const v4 = (i: number) =>
			`${h[i] >> 8}.${h[i] & 255}.${h[i + 1] >> 8}.${h[i + 1] & 255}`;
		const zeros = (n: number) => h.slice(0, n).every((x) => x === 0);
		// The URL parser writes ::ffff:127.0.0.1 as ::ffff:7f00:1, so embedded IPv4 is read from the hextets, never the
		// text: IPv4-mapped (::ffff:0:0/96), IPv4-compatible (::/96, which holds :: and ::1), IPv4-translated
		// (::ffff:0:0:0/96) and 6to4 (2002::/16) all reach the IPv4 address inside them.
		if (zeros(5) && h[5] === 0xffff) return isPrivateAddress(v4(6));
		if (zeros(6)) return isPrivateAddress(v4(6));
		if (zeros(4) && h[4] === 0xffff && h[5] === 0)
			return isPrivateAddress(v4(6));
		if (h[0] === 0x2002) return isPrivateAddress(v4(1));
		return (
			(h[0] & 0xfe00) === 0xfc00 || // fc00::/7 unique local
			(h[0] & 0xffc0) === 0xfe80 || // fe80::/10 link-local
			(h[0] & 0xffc0) === 0xfec0 || // fec0::/10 old site-local
			(h[0] & 0xff00) === 0xff00 || // multicast
			(h[0] === 0x64 && h[1] === 0xff9b) || // NAT64, which reaches any IPv4 address
			(h[0] === 0x100 && h[1] === 0 && h[2] === 0 && h[3] === 0) || // 100::/64 discard
			(h[0] === 0x2001 && (h[1] === 0 || h[1] === 0xdb8)) // Teredo, documentation
		);
	}
	return true;
}

/** The eight 16-bit groups of an IPv6 address (a trailing dotted IPv4 part counts as two), or undefined. */
function hextets(address: string): number[] | undefined {
	let text = address.toLowerCase().replace(/%.*$/, "");
	const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
	if (dotted) {
		const [a, b, c, d] = dotted.slice(1).map(Number);
		text = `${text.slice(0, dotted.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
	}
	const [left, right, extra] = text.split("::");
	if (extra !== undefined) return undefined;
	const head = left ? left.split(":") : [];
	const tail = right ? right.split(":") : [];
	const fill = right === undefined ? 0 : 8 - head.length - tail.length;
	if (fill < 0) return undefined;
	const groups = [...head, ...Array(fill).fill("0"), ...tail];
	if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g)))
		return undefined;
	return groups.map((g) => Number.parseInt(g, 16));
}

/** Why a URL may not be fetched, or undefined when it may. Resolves the host name. */
export async function refusal(
	url: URL,
	resolve = lookup,
): Promise<string | undefined> {
	return (await vet(url, resolve)).refused;
}

/** Either why a URL may not be fetched, or the checked address to connect to. */
async function vet(
	url: URL,
	resolve: typeof lookup,
): Promise<{ refused: string } | { refused?: undefined; address: string }> {
	const no = (refused: string) => ({ refused });
	if (url.protocol !== "http:" && url.protocol !== "https:")
		return no("only http and https addresses");
	if (url.port && url.port !== "80" && url.port !== "443")
		return no("only ports 80 and 443");
	if (url.username || url.password) return no("no credentials in the address");
	const host = url.hostname.replace(/^\[|\]$/g, "");
	if (isIP(host))
		return isPrivateAddress(host) ? no("a private address") : { address: host };
	if (
		!host.includes(".") ||
		/\.(localhost|local|internal|lan|home|corp|test)$/i.test(host)
	)
		return no("not a public host");
	let addresses: { address: string }[];
	try {
		addresses = await resolve(host, { all: true });
	} catch {
		return no("the host name does not resolve");
	}
	if (addresses.length === 0) return no("the host name does not resolve");
	if (addresses.some((a) => isPrivateAddress(a.address)))
		return no("the host resolves to a private address");
	// IPv4 first: not every host (Render included) can reach IPv6, and fetch no longer picks between them.
	const address = addresses.find((a) => isIP(a.address) === 4) ?? addresses[0];
	return { address: address.address };
}

/**
 * The request for `url` sent to `address`, the address that was checked, instead of letting fetch resolve the name
 * again. The host name stays in the Host header and in TLS (SNI and the certificate check).
 */
export function pinned(
	url: URL,
	address: string,
): { input: URL; host: string; serverName?: string } {
	const input = new URL(url);
	input.hostname = isIP(address) === 6 ? `[${address}]` : address;
	const name = url.hostname.replace(/^\[|\]$/g, "");
	return {
		input,
		host: url.host,
		serverName: url.protocol === "https:" && !isIP(name) ? name : undefined,
	};
}

export interface FetchOptions {
	timeoutMs?: number;
	maxBytes?: number;
	maxRedirects?: number;
	/** How host names resolve; tests pass their own. */
	resolve?: typeof lookup;
}

/** Fetches with GET, following up to `maxRedirects` redirects by hand and checking each hop. Never throws. */
export async function safeFetch(
	url: string,
	options: FetchOptions = {},
): Promise<Fetched> {
	const {
		timeoutMs = 8000,
		maxBytes = 2_000_000,
		maxRedirects = 5,
		resolve = lookup,
	} = options;
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
		// A name server that never answers must not hold the check past its time limit.
		const vetted = await Promise.race([
			vet(current, resolve),
			new Promise<undefined>((done) =>
				signal.aborted
					? done(undefined)
					: signal.addEventListener("abort", () => done(undefined), {
							once: true,
						}),
			),
		]);
		if (!vetted)
			return failed(
				`no answer within ${timeoutMs / 1000} seconds`,
				current.href,
			);
		if (!("address" in vetted))
			return failed(`refused: ${vetted.refused}`, current.href);
		const target = pinned(current, vetted.address);
		let response: Response;
		try {
			response = await fetch(target.input, {
				redirect: "manual",
				signal,
				headers: {
					host: target.host,
					"user-agent": USER_AGENT,
					accept: "text/html,text/plain,application/xml;q=0.9,*/*;q=0.5",
				},
				...(target.serverName && { tls: { serverName: target.serverName } }),
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
