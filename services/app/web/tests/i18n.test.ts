import { describe, expect, it } from "bun:test";
import { createApp } from "../src/app";
import { fromAcceptLanguage, pickLang } from "../src/i18n";
import { fakeFetcher, goodSite } from "./fixtures";

const make = () =>
	createApp({
		fetcher: fakeFetcher(goodSite()),
		publicUrl: "https://citable.test/",
	});

describe("language detection", () => {
	it("reads Accept-Language by weight", () => {
		expect(fromAcceptLanguage("ko-KR,ko;q=0.9,en;q=0.8")).toBe("ko");
		expect(fromAcceptLanguage("en-US,en;q=0.9,ko;q=0.8")).toBe("en");
		expect(fromAcceptLanguage("fr;q=0.9, ko;q=0.5")).toBe("ko");
		expect(fromAcceptLanguage("ko;q=0, en")).toBe("en");
		expect(fromAcceptLanguage("fr-FR, de")).toBeUndefined();
		expect(fromAcceptLanguage(undefined)).toBeUndefined();
	});
	it("lets ?lang beat the cookie and the cookie beat the browser", () => {
		const acceptLanguage = "ko-KR";
		expect(pickLang({ query: "en", cookie: "lang=ko", acceptLanguage })).toBe(
			"en",
		);
		expect(pickLang({ cookie: "a=1; lang=en", acceptLanguage })).toBe("en");
		expect(pickLang({ acceptLanguage })).toBe("ko");
		expect(pickLang({ query: "xx", cookie: "lang=yy" })).toBe("en");
	});
});

describe("Korean pages live under /ko", () => {
	const ko = { "accept-language": "ko-KR,ko;q=0.9,en;q=0.5" };
	it("serves English at the root and Korean at /ko", async () => {
		const en = await (await make().request("/")).text();
		expect(en).toContain('<html lang="en">');
		expect(en).toContain("Can AI answers");
		const res = await make().request("/ko");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('<html lang="ko">');
		expect(html).toContain("AI 답변이 내 사이트를");
		expect(html).toContain('content="ko_KR"');
		expect(html).toContain(
			'<link rel="canonical" href="https://citable.test/ko">',
		);
		expect(html).toContain('hreflang="en" href="https://citable.test/"');
		expect(html).toContain('hreflang="ko" href="https://citable.test/ko"');
		expect(html).toContain('action="/ko/check"');
		expect(html).toContain('href="/ko/about"');
	});
	it("sends a Korean browser from / and /about to the /ko page", async () => {
		const home = await make().request("/", { headers: ko, redirect: "manual" });
		expect(home.status).toBe(302);
		expect(home.headers.get("location")).toBe("/ko");
		expect(home.headers.get("vary")).toContain("Accept-Language");
		const about = await make().request("/about", {
			headers: ko,
			redirect: "manual",
		});
		expect(about.headers.get("location")).toBe("/ko/about");
		const site = await make().request("/example.com", {
			headers: ko,
			redirect: "manual",
		});
		expect(site.headers.get("location")).toBe("/ko/example.com");
	});
	it("does not redirect an English browser, or anyone already on /ko", async () => {
		const en = await make().request("/about", {
			headers: { "accept-language": "en-US" },
			redirect: "manual",
		});
		expect(en.status).toBe(200);
		const stay = await make().request("/ko/about", {
			headers: { "accept-language": "en-US" },
			redirect: "manual",
		});
		expect(stay.status).toBe(200);
		expect(await stay.text()).toContain("검사기는 이렇게 작동합니다");
	});
	it("lets ?lang override the browser and remember it in a cookie", async () => {
		const toEn = await make().request("/ko/about?lang=en", {
			headers: ko,
			redirect: "manual",
		});
		expect(toEn.status).toBe(303);
		expect(toEn.headers.get("location")).toBe("/about");
		expect(toEn.headers.get("set-cookie")).toContain("lang=en");
		const toKo = await make().request("/about?lang=ko", { redirect: "manual" });
		expect(toKo.headers.get("location")).toBe("/ko/about");
		expect(toKo.headers.get("set-cookie")).toContain("lang=ko");
		const cookie = await make().request("/", {
			headers: { cookie: "lang=en", "accept-language": "ko" },
			redirect: "manual",
		});
		expect(cookie.status).toBe(200);
	});
	it("renders a report at /ko/<site> in Korean", async () => {
		const res = await make().request("/ko/example.com");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('<html lang="ko">');
		expect(html).toContain("점수 공유하기");
		expect(html).toContain("/100");
	});
	it("keeps the Korean form on /ko after a check", async () => {
		const res = await make().request("/ko/check?url=example.com", {
			redirect: "manual",
		});
		expect(res.headers.get("location")).toBe("/ko/example.com");
	});
	it("lists the Korean pages in the sitemap", async () => {
		const xml = await (await make().request("/sitemap.xml")).text();
		expect(xml).toContain("https://citable.test/ko</loc>");
		expect(xml).toContain("https://citable.test/ko/about</loc>");
	});
});
