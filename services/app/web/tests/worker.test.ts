import { describe, expect, it, spyOn } from "bun:test";
import { VIDEO } from "../src/video.generated";
import worker, { STATIC_FILES } from "../src/worker";

describe("Cloudflare Worker entry", () => {
	it("reserves exactly the clip files the Worker serves as static assets", () => {
		expect([...STATIC_FILES].sort()).toEqual(Object.keys(VIDEO).sort());
	});

	it("answers byte ranges for the clip from the static assets", async () => {
		const bytes = new Uint8Array([1, 2, 3, 4, 5]);
		const env = {
			ASSETS: {
				fetch: async (r: Request) =>
					new URL(r.url).pathname === "/demo.mp4" && !r.headers.get("range")
						? new Response(bytes, { headers: { "content-type": "video/mp4" } })
						: new Response("nope", { status: 404 }),
			},
		};
		const part = await worker.fetch(
			new Request("https://citable.flisk.si/demo.mp4", {
				headers: { range: "bytes=1-2" },
			}),
			env,
			{},
		);
		expect(part.status).toBe(206);
		expect(part.headers.get("content-range")).toBe("bytes 1-2/5");
		expect([...new Uint8Array(await part.arrayBuffer())]).toEqual([2, 3]);
		const full = await worker.fetch(
			new Request("https://citable.flisk.si/demo.mp4"),
			env,
			{},
		);
		expect(full.status).toBe(200);
		expect(full.headers.get("accept-ranges")).toBe("bytes");
	});

	it("serves the app and never reads a static file name as a site to check", async () => {
		const fetchSpy = spyOn(globalThis, "fetch");
		const env = {
			CITABLE_PUBLIC_URL: "https://citable.flisk.si/",
			CITABLE_PROXY: "cloudflare",
		};
		const ready = await worker.fetch(
			new Request("https://citable.flisk.si/ready"),
			env,
			{},
		);
		expect(ready.status).toBe(200);
		const clip = await worker.fetch(
			new Request("https://citable.flisk.si/demo.mp4"),
			env,
			{},
		);
		expect(clip.status).toBe(404);
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});
});
