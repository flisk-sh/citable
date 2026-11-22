import { describe, expect, it } from "bun:test";
import { aboutPage, homePage } from "../src/ui";

const skip = '<a class="skip-link" href="#main">Skip to content</a>';
const pages = [
	homePage("https://citable.flisk.si/"),
	homePage("https://citable.flisk.si/", false, "ko"),
	aboutPage("https://citable.flisk.si/"),
];

describe("citable skip link", () => {
	it("is the first focusable element in the body", () => {
		for (const html of pages) {
			expect(html).toContain(`<body>${skip}`);
			expect(html.indexOf(skip)).toBeLessThan(html.indexOf('<header class="bar stage">'));
		}
	});

	it("has a main target on every page", () => {
		for (const html of pages) {
			expect(html).toContain('<main id="main">');
		}
	});

	it("is hidden until focused", () => {
		for (const html of pages) {
			expect(html).toContain(".skip-link{position:absolute;left:-9999px");
			expect(html).toContain(".skip-link:focus{left:12px;top:12px");
		}
	});
});
