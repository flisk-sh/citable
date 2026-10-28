import { describe, expect, it } from "bun:test";
import { isPrivateAddress, normalizeTarget, refusal } from "../src/net";

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

	it("refuses a name that does not resolve", async () => {
		const fail = (async () => {
			throw new Error("ENOTFOUND");
		}) as never;
		expect(await refusal(new URL("https://nope.example/"), fail)).toContain(
			"resolve",
		);
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
