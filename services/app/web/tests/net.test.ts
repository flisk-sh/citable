import { afterEach, describe, expect, it, spyOn } from "bun:test";
import {
	isPrivateAddress,
	normalizeTarget,
	pinned,
	refusal,
	safeFetch,
} from "../src/net";

const resolvesTo =
	(...addresses: string[]) =>
	async () =>
		addresses.map((address) => ({
			address,
			family: address.includes(":") ? 6 : 4,
		}));

describe("isPrivateAddress", () => {
	it.each([
		"10.0.0.1",
		"127.0.0.1",
		"169.254.169.254",
		"172.16.0.1",
		"172.31.255.255",
		"192.168.1.1",
		"100.64.0.1",
		"0.0.0.0",
		"224.0.0.1",
		"::1",
		"::",
		"fd00::1",
		"fe80::1",
		"::ffff:127.0.0.1",
		"64:ff9b::a00:1",
		// The URL parser's own spelling of ::ffff:127.0.0.1 and ::ffff:169.254.169.254, and other forms that embed IPv4.
		"::ffff:7f00:1",
		"::ffff:a9fe:a9fe",
		"0:0:0:0:0:ffff:7f00:1",
		"::7f00:1",
		"::127.0.0.1",
		"::ffff:0:a9fe:a9fe",
		"2002:a9fe:a9fe::1",
		"2001:0:4136:e378::1",
		"fec0::1",
		"not-an-ip",
	])("refuses %s", (address) => {
		expect(isPrivateAddress(address)).toBe(true);
	});

	it.each([
		"1.1.1.1",
		"93.184.216.34",
		"172.32.0.1",
		"2606:4700::1111",
		"::ffff:8.8.8.8",
		"::ffff:808:808",
		"2002:808:808::1",
	])("allows %s", (address) => {
		expect(isPrivateAddress(address)).toBe(false);
	});
});

describe("refusal", () => {
	it("allows a public host on the default ports", async () => {
		expect(
			await refusal(
				new URL("https://example.com/"),
				resolvesTo("93.184.216.34") as never,
			),
		).toBeUndefined();
	});

	it("refuses a host that resolves to any private address", async () => {
		expect(
			await refusal(
				new URL("https://evil.example/"),
				resolvesTo("1.1.1.1", "10.0.0.5") as never,
			),
		).toContain("private");
	});

	it("refuses other ports, schemes, credentials and local names", async () => {
		const resolve = resolvesTo("1.1.1.1") as never;
		expect(
			await refusal(new URL("https://example.com:8080/"), resolve),
		).toContain("ports");
		expect(await refusal(new URL("ftp://example.com/"), resolve)).toContain(
			"http",
		);
		expect(
			await refusal(new URL("https://u:p@example.com/"), resolve),
		).toContain("credentials");
		expect(await refusal(new URL("http://localhost/"), resolve)).toBe(
			"not a public host",
		);
		expect(await refusal(new URL("http://printer.local/"), resolve)).toBe(
			"not a public host",
		);
		expect(await refusal(new URL("http://127.0.0.1/"), resolve)).toContain(
			"private",
		);
		expect(await refusal(new URL("http://[::1]/"), resolve)).toContain(
			"private",
		);
	});

	it("refuses IPv6 literals that embed a private IPv4 address", async () => {
		const resolve = resolvesTo("1.1.1.1") as never;
		for (const href of [
			"http://[::ffff:127.0.0.1]/",
			"http://[::ffff:169.254.169.254]/latest/meta-data/",
			"http://[::ffff:10.0.0.1]/",
			"http://[::127.0.0.1]/",
		])
			expect(await refusal(new URL(href), resolve)).toContain("private");
	});

	it("refuses a name that does not resolve", async () => {
		const fail = (async () => {
			throw new Error("ENOTFOUND");
		}) as never;
		expect(await refusal(new URL("https://nope.example/"), fail)).toContain(
			"resolve",
		);
	});
});

describe("pinned requests", () => {
	afterEach(() => {
		(
			globalThis.fetch as unknown as { mockRestore?: () => void }
		).mockRestore?.();
	});

	it("sends the request to the checked address, keeping the name for Host and TLS", () => {
		const https = pinned(new URL("https://example.com/a?b=1"), "93.184.216.34");
		expect(https.input.href).toBe("https://93.184.216.34/a?b=1");
		expect(https.host).toBe("example.com");
		expect(https.serverName).toBe("example.com");
		const v6 = pinned(new URL("http://example.com/"), "2606:4700::1111");
		expect(v6.input.href).toBe("http://[2606:4700::1111]/");
		expect(v6.serverName).toBeUndefined();
	});

	it("does not resolve the name again between the check and the request (DNS rebinding)", async () => {
		let lookups = 0;
		// The first answer is public, every later one private: what a rebinding name server does.
		const rebinding = (async () => [
			{ address: lookups++ === 0 ? "93.184.216.34" : "127.0.0.1", family: 4 },
		]) as never;
		const seen: { url: string; host: string | null }[] = [];
		spyOn(globalThis, "fetch").mockImplementation((async (
			input: URL,
			init: RequestInit,
		) => {
			seen.push({
				url: String(input),
				host: new Headers(init.headers).get("host"),
			});
			return new Response("<title>ok</title>", { status: 200 });
		}) as never);
		const page = await safeFetch("http://rebind.example/", {
			resolve: rebinding,
		});
		expect(page.status).toBe(200);
		expect(page.finalUrl).toBe("http://rebind.example/");
		expect(seen).toEqual([
			{ url: "http://93.184.216.34/", host: "rebind.example" },
		]);
		expect(lookups).toBe(1);
	});

	it("gives up on a name server that does not answer in time", async () => {
		const hang = (() => new Promise(() => {})) as never;
		const page = await safeFetch("http://slow.example/", {
			resolve: hang,
			timeoutMs: 50,
		});
		expect(page.error).toContain("no answer");
	});
});

describe("normalizeTarget", () => {
	it("reads what visitors type and paste", () => {
		expect(normalizeTarget("example.com")?.href).toBe("https://example.com/");
		expect(normalizeTarget("  Example.COM/Docs  ")?.href).toBe(
			"https://example.com/Docs",
		);
		expect(normalizeTarget("http://example.com/a?b=1#c")?.href).toBe(
			"http://example.com/a?b=1",
		);
		expect(normalizeTarget("https:/example.com/x")?.href).toBe(
			"https://example.com/x",
		);
	});

	it("rejects what is not a web address", () => {
		expect(normalizeTarget("")).toBeUndefined();
		expect(normalizeTarget("localhost")).toBeUndefined();
		expect(normalizeTarget("javascript:alert(1)")).toBeUndefined();
		expect(normalizeTarget("exa mple.com")).toBeUndefined();
	});
});
