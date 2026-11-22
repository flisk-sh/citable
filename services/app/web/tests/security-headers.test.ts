import { describe, expect, it } from "bun:test";
import { withSecurityHeaders } from "../src/security-headers";
import worker from "../src/worker";

describe("security headers", () => {
	it("adds the baseline to a bare response and a frame-ancestors policy", () => {
		const res = withSecurityHeaders(new Response("hi"));
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
		expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
		expect(res.headers.get("strict-transport-security")).toBe(
			"max-age=31536000; includeSubDomains",
		);
		expect(res.headers.get("referrer-policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		expect(res.headers.get("permissions-policy")).toBe(
			"camera=(), microphone=(), geolocation=()",
		);
		expect(res.headers.get("content-security-policy")).toBe(
			"frame-ancestors 'self' https://analytics.flisk.si",
		);
	});

	it("keeps headers and a policy the app already set", () => {
		const res = withSecurityHeaders(
			new Response("hi", {
				headers: {
					"x-frame-options": "DENY",
					"content-security-policy": "default-src 'none'",
				},
			}),
		);
		expect(res.headers.get("x-frame-options")).toBe("DENY");
		expect(res.headers.get("content-security-policy")).toBe(
			"default-src 'none'; frame-ancestors 'self' https://analytics.flisk.si",
		);
		const own = withSecurityHeaders(
			new Response("hi", {
				headers: { "content-security-policy": "frame-ancestors 'none'" },
			}),
		);
		expect(own.headers.get("content-security-policy")).toBe(
			"frame-ancestors 'none'",
		);
	});

	it("works on responses with immutable headers", () => {
		const res = withSecurityHeaders(Response.redirect("https://example.com"));
		expect(res.status).toBe(302);
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
	});

	it("covers the Worker's pages and its static assets", async () => {
		const page = await worker.fetch(
			new Request("https://citable.flisk.si/"),
			{},
			{},
		);
		expect(page.headers.get("x-frame-options")).toBe("SAMEORIGIN");
		expect(page.headers.get("x-content-type-options")).toBe("nosniff");
		const asset = await worker.fetch(
			new Request("https://citable.flisk.si/demo.mp4"),
			{
				ASSETS: {
					fetch: async () =>
						new Response(new Uint8Array([1, 2]), {
							headers: { "content-type": "video/mp4" },
						}),
				},
			},
			{},
		);
		expect(asset.headers.get("x-frame-options")).toBe("SAMEORIGIN");
		expect(asset.headers.get("content-security-policy")).toBe(
			"frame-ancestors 'self' https://analytics.flisk.si",
		);
	});
});
