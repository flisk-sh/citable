// The 13-second "how it works" clip on the home page and in the README, drawn frame by frame as SVG (no screen
// recording, so it is sharp, small and the same on every run). Run it after changing a scene:
//   bun run video
// Writes src/video.generated.ts (MP4 and a poster, served at /demo.mp4 and /demo.jpg) and docs/demo.gif.
// Needs ffmpeg on the PATH.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const W = 960;
const H = 540;
const FPS = 25;
const here = new URL("..", import.meta.url).pathname;

const C = {
	bg: "#fbfaf7",
	fg: "#1d1c1a",
	muted: "#6b6862",
	line: "#e6e2da",
	card: "#ffffff",
	pass: "#1f7a4d",
	warn: "#a86400",
	accent: "#2d4cc8",
};
const SANS = "Helvetica, Arial, sans-serif";
const MONO = "Menlo, monospace";

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 → 1 between `from` and `to` seconds, eased. */
const ease = (t: number, from: number, to: number) => {
	const x = clamp((t - from) / (to - from));
	return x * x * (3 - 2 * x);
};
const esc = (s: string) =>
	s.replace(
		/[&<>]/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string,
	);

function caption(text: string, opacity: number) {
	return `<g opacity="${opacity}"><rect x="0" y="${H - 64}" width="${W}" height="64" fill="${C.fg}"/><text x="${W / 2}" y="${H - 24}" text-anchor="middle" font-family="${SANS}" font-size="26" font-weight="700" fill="${C.bg}">${esc(text)}</text></g>`;
}

function addressBar(prefix: string, rest: string, cursor: boolean) {
	return `<rect x="80" y="70" width="800" height="64" rx="32" fill="${C.card}" stroke="${C.line}" stroke-width="2"/>
<circle cx="120" cy="102" r="9" fill="none" stroke="${C.muted}" stroke-width="3"/><line x1="126" y1="108" x2="133" y2="115" stroke="${C.muted}" stroke-width="3"/>
<text x="150" y="113" font-family="${MONO}" font-size="30"><tspan fill="${C.accent}" font-weight="700">${esc(prefix)}</tspan><tspan fill="${C.fg}">${esc(rest)}</tspan>${cursor ? `<tspan fill="${C.accent}">|</tspan>` : ""}</text>`;
}

function ring(cx: number, cy: number, score: number) {
	const r = 70;
	const len = 2 * Math.PI * r;
	return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.line}" stroke-width="16"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.pass}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${(len * score) / 100} ${len}" transform="rotate(-90 ${cx} ${cy})"/>
<text x="${cx}" y="${cy + 18}" text-anchor="middle" font-family="${SANS}" font-size="52" font-weight="800" fill="${C.fg}">${Math.round(score)}</text>`;
}

const CHECKS: [string, string, string][] = [
	["pass", "AI answer engines can crawl it", "25 / 25"],
	["pass", "Indexable, snippets allowed", "15 / 15"],
	["pass", "Text readable without JavaScript", "15 / 15"],
	["warn", "Two h1 headings: keep one", "3 / 5"],
	["pass", "schema.org data: Organization", "10 / 10"],
];

function checkRow(i: number, opacity: number, dy: number) {
	const [status, title, pts] = CHECKS[i];
	const y = 190 + i * 52 + dy;
	const color = status === "pass" ? C.pass : C.warn;
	return `<g opacity="${opacity}"><rect x="80" y="${y}" width="800" height="42" rx="10" fill="${C.card}" stroke="${C.line}" stroke-width="2"/>
<circle cx="104" cy="${y + 21}" r="7" fill="${color}"/><text x="124" y="${y + 28}" font-family="${SANS}" font-size="21" font-weight="700" fill="${C.fg}">${esc(title)}</text>
<text x="860" y="${y + 28}" text-anchor="end" font-family="${SANS}" font-size="19" fill="${C.muted}">${pts}</text></g>`;
}

function button(x: number, label: string, opacity: number) {
	return `<g opacity="${opacity}"><rect x="${x}" y="230" width="230" height="60" rx="14" fill="${C.card}" stroke="${C.line}" stroke-width="2"/><text x="${x + 115}" y="268" text-anchor="middle" font-family="${SANS}" font-size="24" font-weight="700" fill="${C.fg}">${label}</text></g>`;
}

const DURATION = 13;

function frame(t: number): string {
	const parts: string[] = [`<rect width="${W}" height="${H}" fill="${C.bg}"/>`];
	if (t < 3.4) {
		// 1. The address, then citable.flisk.si/ typed in front of it.
		const prefix = "citable.flisk.si/";
		const typed = Math.floor(clamp((t - 0.6) / 1.6) * prefix.length);
		parts.push(
			addressBar(
				prefix.slice(0, typed),
				"stripe.com",
				Math.floor(t * 2) % 2 === 0,
			),
		);
		parts.push(
			`<text x="${W / 2}" y="300" text-anchor="middle" font-family="${SANS}" font-size="44" font-weight="800" fill="${C.fg}" opacity="${ease(t, 2.2, 2.8)}">Can AI answers cite stripe.com?</text>`,
		);
		parts.push(
			caption(
				"Put citable.flisk.si/ in front of any address",
				ease(t, 0.1, 0.5),
			),
		);
	} else if (t < 6.6) {
		// 2. The score fills in.
		const s = t - 3.4;
		parts.push(ring(250, 250, 96 * ease(s, 0.2, 1.6)));
		parts.push(
			`<text x="380" y="235" font-family="${SANS}" font-size="44" font-weight="800" fill="${C.fg}">stripe.com</text>`,
		);
		parts.push(
			`<text x="380" y="280" font-family="${SANS}" font-size="24" fill="${C.muted}" opacity="${ease(s, 1.2, 1.8)}">Grade A · 1 thing to improve</text>`,
		);
		parts.push(caption("It reads the page the way AI crawlers do", 1));
	} else if (t < 10) {
		// 3. The checks, one by one, each with its fix.
		const s = t - 6.6;
		parts.push(
			`<text x="80" y="150" font-family="${SANS}" font-size="30" font-weight="800" fill="${C.fg}">stripe.com · 96 / 100</text>`,
		);
		for (let i = 0; i < CHECKS.length; i++) {
			const o = ease(s, 0.2 + i * 0.4, 0.5 + i * 0.4);
			parts.push(checkRow(i, o, (1 - o) * 12));
		}
		parts.push(caption("Crawler by crawler, with the fix for each problem", 1));
	} else {
		// 4. Hand the fixes to your own AI.
		const s = t - 10;
		parts.push(
			`<text x="${W / 2}" y="170" text-anchor="middle" font-family="${SANS}" font-size="36" font-weight="800" fill="${C.fg}">Fix it with your AI</text>`,
		);
		parts.push(button(230, "Ask ChatGPT", ease(s, 0.1, 0.5)));
		parts.push(button(500, "Ask Claude", ease(s, 0.3, 0.7)));
		parts.push(
			`<text x="${W / 2}" y="370" text-anchor="middle" font-family="${MONO}" font-size="20" fill="${C.muted}" opacity="${ease(s, 0.8, 1.2)}">claude mcp add --transport http citable citable.flisk.si/mcp</text>`,
		);
		parts.push(
			caption("Free, no signup, nothing stored. Also an MCP server.", 1),
		);
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("\n")}</svg>`;
}

const render = (svg: string) =>
	new Resvg(svg, {
		font: { loadSystemFonts: true, defaultFontFamily: "Helvetica" },
	})
		.render()
		.asPng();

if (import.meta.main) {
	const work = mkdtempSync(join(tmpdir(), "video-"));
	try {
		const frames = Math.round(DURATION * FPS);
		for (let i = 0; i < frames; i++)
			writeFileSync(
				join(work, `f${String(i).padStart(4, "0")}.png`),
				render(frame(i / FPS)),
			);
		const run = (args: string[]) => {
			const r = Bun.spawnSync(["ffmpeg", "-loglevel", "error", "-y", ...args]);
			if (r.exitCode !== 0) throw new Error(r.stderr.toString());
		};
		const input = ["-framerate", String(FPS), "-i", join(work, "f%04d.png")];
		const mp4 = join(work, "demo.mp4");
		run([
			...input,
			"-c:v",
			"libx264",
			"-pix_fmt",
			"yuv420p",
			"-crf",
			"28",
			"-preset",
			"slow",
			"-movflags",
			"+faststart",
			"-an",
			mp4,
		]);
		const poster = join(work, "demo.jpg");
		run([
			"-i",
			join(work, `f${String(Math.round(8.6 * FPS)).padStart(4, "0")}.png`),
			"-q:v",
			"4",
			poster,
		]);
		run([
			...input,
			"-vf",
			"fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48[p];[b][p]paletteuse=dither=none",
			join(here, "../../../docs/demo.gif"),
		]);
		const b64 = (f: string) => readFileSync(f).toString("base64");
		writeFileSync(
			join(here, "src", "video.generated.ts"),
			`// Written by \`bun run video\` (scripts/video.ts). Do not edit.\nexport const VIDEO = {\n\t"demo.mp4": { type: "video/mp4", base64: "${b64(mp4)}" },\n\t"demo.jpg": { type: "image/jpeg", base64: "${b64(poster)}" },\n};\n`,
		);
		console.log(
			`Wrote src/video.generated.ts (${Math.round(readFileSync(mp4).length / 1024)} KB video) and docs/demo.gif`,
		);
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}
