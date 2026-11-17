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

describe("Korean pages", () => {
	it("serves English with no preference and Korean to a Korean browser", async () => {
		const en = await (await make().request("/")).text();
		expect(en).toContain('<html lang="en">');
		expect(en).toContain("Can AI answers");
		const res = await make().request("/", {
			headers: { "accept-language": "ko-KR,ko;q=0.9,en;q=0.5" },
		});
		const ko = await res.text();
		expect(ko).toContain('<html lang="ko">');
		expect(ko).toContain("AI 답변이 내 사이트를");
		expect(ko).toContain('content="ko_KR"');
		expect(res.headers.get("vary")).toContain("Accept-Language");
	});
	it("remembers an explicit ?lang in a cookie", async () => {
		const res = await make().request("/about?lang=ko");
		expect(await res.text()).toContain("검사기는 이렇게 작동합니다");
		expect(res.headers.get("set-cookie")).toContain("lang=ko");
		const back = await make().request("/about", {
			headers: { cookie: "lang=ko", "accept-language": "en" },
		});
		expect(await back.text()).toContain('<html lang="ko">');
	});
	it("renders a report in Korean and checks the same site for ?lang", async () => {
		const res = await make().request("/example.com?lang=ko");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('<html lang="ko">');
		expect(html).toContain("점수 공유하기");
		expect(html).toContain("/100");
	});
	it("keeps the canonical address free of ?lang", async () => {
		const html = await (await make().request("/about?lang=ko")).text();
		expect(html).toContain(
			'<link rel="canonical" href="https://citable.test/about">',
		);
	});
});
