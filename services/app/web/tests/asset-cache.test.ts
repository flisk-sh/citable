import { expect, test } from "bun:test";

test("the deployed hero assets have an explicit bounded cache lifetime", async () => {
	const headers = (
		await Bun.file(new URL("../public/_headers", import.meta.url)).text()
	).replaceAll("\r\n", "\n");
	for (const path of ["/demo.jpg", "/demo.mp4"]) {
		const section = headers
			.split("\n\n")
			.find((block) => block.startsWith(path + "\n"));
		expect(section).toContain("Cache-Control: public, max-age=604800");
	}
});
