// Languages. The pages are written once per language here and picked per request: ?lang=ko, else the lang cookie, else
// the browser's Accept-Language header, else English. The checks' own findings (checks.ts) stay in English; their titles
// are translated in `checkTitle`.

import { SITE } from "./site";

export const LANGS = ["en", "ko"] as const;
export type Lang = (typeof LANGS)[number];

const isLang = (s: string | undefined): s is Lang =>
	!!s && (LANGS as readonly string[]).includes(s);

/** The language an Accept-Language header asks for first, by q weight; undefined when it names none we write. */
export function fromAcceptLanguage(
	header: string | undefined,
): Lang | undefined {
	if (!header) return undefined;
	const ranked = header
		.split(",")
		.map((part, index) => {
			const [tag, ...params] = part.trim().split(";");
			const q = params
				.map((p) => p.trim().match(/^q=([\d.]+)$/)?.[1])
				.find(Boolean);
			return {
				primary: tag.trim().toLowerCase().split("-")[0],
				q: q === undefined ? 1 : Number(q),
				index,
			};
		})
		.filter((l) => l.q > 0 && Number.isFinite(l.q))
		.sort((a, b) => b.q - a.q || a.index - b.index);
	return ranked.map((l) => l.primary).find(isLang);
}

/** The visitor's language: an explicit ?lang= wins, then the cookie it set, then the browser's own list. */
export function pickLang(input: {
	query?: string;
	cookie?: string;
	acceptLanguage?: string;
}): Lang {
	const cookie = input.cookie?.match(/(?:^|;\s*)lang=(\w+)/)?.[1];
	return (
		(isLang(input.query) ? input.query : undefined) ??
		(isLang(cookie) ? cookie : undefined) ??
		fromAcceptLanguage(input.acceptLanguage) ??
		"en"
	);
}

export interface Copy {
	htmlLang: string;
	ogLocale: string;
	switchTo: string;
	switchLabel: string;
	tagline: string;
	description: string;
	faq: { q: string; a: string }[];
	// header and footer
	navHow: string;
	navAbout: string;
	addressLabel: string;
	check: string;
	footerNote: string;
	footerOpen: string;
	footerBuilt: string;
	footerAbout: string;
	footerGrow: string;
	// home
	pill: string;
	h1Before: string;
	h1Em: string;
	h1After: string;
	lede: (host: string) => string;
	note: string;
	tryLabel: string;
	enginesLabel: string;
	sample: {
		aria: string;
		label: string;
		score: string;
		grade: string;
		summary: string;
		rows: [string, string, string][];
	};
	stats: [string, string][];
	filmKicker: string;
	filmTitle: string;
	filmSub: string;
	filmCaption: string;
	howKicker: string;
	howTitle: string;
	howSub: string;
	steps: [string, string][];
	afterFixes: string;
	checksKicker: string;
	checksTitle: string;
	checksSub: string;
	checks: [string, string][];
	mcpKicker: string;
	mcpTitle: string;
	mcpSub: string;
	// report
	couldNotCheck: (host: string) => string;
	couldNotCheckDescription: (host: string) => string;
	couldNotRead: (error: string) => string;
	reportTitle: (host: string, score: number) => string;
	reportDescription: (
		host: string,
		score: number,
		grade: string,
		fixes: number,
	) => string;
	scoreAria: (score: number) => string;
	grade: string;
	nothingToFix: string;
	toFix: (n: number, worth: number) => string;
	checkedAt: (when: string) => string;
	checkAgain: string;
	answerEngines: string;
	allowedOf: (allowed: number, total: number) => string;
	allowed: string;
	blocked: string;
	training: (allowed: number, blocked: number) => string;
	partial: (status: string) => string;
	fixFirst: string;
	howToFix: string;
	details: string;
	ctaTitle: string;
	ctaText: string;
	askChatGpt: string;
	askClaude: string;
	handedText: string;
	passing: string;
	notes: string;
	shareTitle: string;
	shareText: string;
	badgeTitle: string;
	badgeHint: string;
	badgeAlt: (score: number) => string;
	pointsByCheck: string;
	checksByWeight: (n: number) => string;
	splitLabel: { pass: string; warn: string; fail: string };
	status: { pass: string; warn: string; fail: string; info: string };
	// prompts and share text
	fixPrompt: (url: string, score: number) => string;
	fixLine: string;
	shareMessage: (host: string, score: number) => string;
	shareSubject: (host: string, score: number) => string;
	// about
	aboutTitle: string;
	aboutDescription: string;
	aboutCrumb: string;
	aboutKicker: string;
	aboutH1: string;
	aboutBody: (base: string) => string[];
	aboutQuestions: string;
}

const en: Copy = {
	htmlLang: "en",
	ogLocale: "en_US",
	switchTo: "ko",
	switchLabel: "한국어",
	tagline: SITE.tagline,
	description: SITE.description,
	faq: [...SITE.faq],
	navHow: "How it works",
	navAbout: "About",
	addressLabel: "Site address",
	check: "Check",
	footerNote:
		"reads pages the way an AI crawler does: no JavaScript, no model, nothing stored.",
	footerOpen: "Open source",
	footerBuilt: "built and run with",
	footerAbout: "About the checker",
	footerGrow: "Next step: get your first customers on",
	pill: "Open source · with an MCP server",
	h1Before: "Can AI answers ",
	h1Em: "cite",
	h1After: " your site?",
	lede: (host) =>
		`Put <b>${host}/</b> in front of any address. Citable reads your page like AI crawlers do and tells you what keeps it out of their answers, with the fix.`,
	note: "<b>●</b> Free score in seconds · No signup · Nothing stored",
	tryLabel: "Try",
	enginesLabel: "Checked crawler by crawler for",
	sample: {
		aria: "A sample report",
		label: "Sample report",
		score: "Score 41 of 100",
		grade: "grade D",
		summary: "3 things to fix, worth up to 34 points",
		rows: [
			[
				"AI crawlers allowed",
				"+18",
				"robots.txt blocks OAI-SearchBot and Claude-SearchBot",
			],
			[
				"Readable without JavaScript",
				"+11",
				"Only 40 words in the HTML before scripts run",
			],
			["llms.txt", "+5", "Not found at /llms.txt"],
			[
				"Title and description",
				"10 / 10",
				"Both present, at lengths engines show",
			],
		],
	},
	stats: [
		["10", "checks, weighted by what decides a citation"],
		["", "answer-engine crawlers, read one by one"],
		["4", "requests at most, all of them GETs"],
		["0", "accounts, models or stored pages"],
	],
	filmKicker: "See it run",
	filmTitle: "From address to fix in 23 seconds.",
	filmSub:
		"Type the prefix, read the score, open a fix, and hand the whole list to your own AI.",
	filmCaption:
		"A 23-second film: citable.flisk.si/ is typed in front of stripe.com in a browser, the report scores it 96 out of 100, the camera moves to a check and its fix, and a click on Ask Claude hands the fixes to your own AI.",
	howKicker: "How it works",
	howTitle: "One address, one honest report.",
	howSub:
		"No account, no browser extension, no model guessing. Citable fetches what a crawler fetches and reads it the same way.",
	steps: [
		[
			"Prefix any address",
			"citable.flisk.si/your-site.com, or paste it in the box above. Any page works, not only home pages.",
		],
		[
			"Read it like a crawler",
			"The page, robots.txt, llms.txt and the sitemap, with no JavaScript, as the seven answer crawlers see them.",
		],
		[
			"Fix what blocks citations",
			"Each problem comes with the exact change to make, and a button that hands the list to your own AI.",
		],
	],
	afterFixes: "after the fixes",
	checksKicker: "What it checks",
	checksTitle: "Ten checks, scored out of 100.",
	checksSub:
		"Weighted by how much each one decides whether an answer engine can quote you at all.",
	checks: [
		[
			"AI crawlers allowed",
			"robots.txt, read for each answer engine's crawler on its own.",
		],
		[
			"Indexable and quotable",
			"Status, HTTPS, and no noindex or nosnippet in the page or its headers.",
		],
		[
			"Readable without JavaScript",
			"The text is in the HTML the server sends, not painted in later.",
		],
		[
			"Title and description",
			"Present, and a length engines show next to the citation.",
		],
		["Structured data", "schema.org JSON-LD that says what the page is."],
		["Headings", "One h1, and h2 sections engines can quote on their own."],
		["Canonical address", "One address for the page, so citations add up."],
		["Sitemap", "Listed in robots.txt, so crawlers find every page."],
		["llms.txt", "A short map of the site written for language models."],
		["Response time", "Time to first byte, which crawlers on a budget notice."],
	],
	mcpKicker: "In your AI",
	mcpTitle: "Ask your assistant directly.",
	mcpSub:
		'Citable is also an MCP server. Add it once, then ask "can AI cite example.com?"',
	couldNotCheck: (host) => `${host}: could not check`,
	couldNotCheckDescription: (host) =>
		`Citable could not read ${host}, so it cannot say whether ChatGPT, Claude, Perplexity and Google AI can cite it.`,
	couldNotRead: (error) => `Could not read the page: ${error}.`,
	reportTitle: (host, score) => `${host}: ${score}/100 for AI search`,
	reportDescription: (host, score, grade, fixes) =>
		`Can ChatGPT, Claude, Perplexity and Google AI cite ${host}? Score ${score}/100, grade ${grade}, ${fixes} ${fixes === 1 ? "thing" : "things"} to fix, each with the fix.`,
	scoreAria: (score) => `Score ${score} of 100`,
	grade: "grade",
	nothingToFix: "✓ Nothing to fix",
	toFix: (n, worth) =>
		`${n} ${n === 1 ? "thing" : "things"} to fix${worth > 0 ? `, worth up to ${worth} points` : ""}`,
	checkedAt: (when) => `Checked ${when} UTC`,
	checkAgain: "Check again",
	answerEngines: "Answer engines",
	allowedOf: (a, t) => `${a} of ${t} allowed`,
	allowed: "allowed",
	blocked: "blocked",
	training: (a, b) =>
		`Training crawlers: ${a} allowed, ${b} blocked. Not scored: it does not change whether answers cite you.`,
	partial: (status) =>
		`Partial report: the page answered ${status}, so its contents were not checked.`,
	fixFirst: "Fix first",
	howToFix: "How to fix",
	details: "Details",
	ctaTitle: "Fix it with your AI",
	ctaText:
		"Citable never calls a model. Hand the list to yours, with the exact fixes.",
	askChatGpt: "Ask ChatGPT",
	askClaude: "Ask Claude",
	handedText: "The text it hands over",
	passing: "Passing",
	notes: "Notes",
	shareTitle: "Share this score",
	shareText:
		"Opens the network in a new tab with the link. Citable receives nothing.",
	badgeTitle: "Show the score",
	badgeHint: "Click the code to select it",
	badgeAlt: (score) => `AI search score ${score}`,
	pointsByCheck: "Points by check",
	checksByWeight: (n) => `${n} checks, by weight`,
	splitLabel: { pass: "passing", warn: "to improve", fail: "to fix" },
	status: { pass: "Pass", warn: "Improve", fail: "Fix", info: "Note" },
	fixPrompt: (url, score) =>
		`Citable checked ${url} for AI search (score ${score}/100). Help me fix these, most important first, with the exact code or config to change:`,
	fixLine: "Suggested fix",
	shareMessage: (host, score) =>
		`${host} scores ${score}/100 for AI search. Can ChatGPT, Claude and Perplexity cite it?`,
	shareSubject: (host, score) => `${host}: ${score}/100 for AI search`,
	aboutTitle: "About the checker",
	aboutDescription:
		"How Citable checks a site for AI search: what it fetches, the crawler it sends, what it stores, and answers to common questions.",
	aboutCrumb: "About",
	aboutKicker: "About",
	aboutH1: "How the checker works",
	aboutBody: (base) => [
		`For each check, Citable fetches at most four addresses from the site: the page, <code>/robots.txt</code>, <code>/llms.txt</code> and the sitemap. It identifies itself as <code>CitableBot/1.0 (+${base}/about)</code>, sends only GET requests, follows at most five redirects, reads at most 2 MB, and only reaches public addresses on ports 80 and 443.`,
		`A report is kept in memory for an hour so a shared link does not fetch the site again, then forgotten. Nothing is stored on disk; there is no database and no account.`,
		`Robots rules are read as RFC 9309 says: the group that names a crawler, else the <code>*</code> group, and the longest matching rule. Citable does not pretend to be another crawler, so a firewall that blocks some user agents may treat the real ones differently.`,
	],
	aboutQuestions: "Questions",
};

const ko: Copy = {
	htmlLang: "ko",
	ogLocale: "ko_KR",
	switchTo: "en",
	switchLabel: "English",
	tagline: "AI 답변이 내 사이트를 인용할 수 있을까요?",
	description:
		"ChatGPT, Claude, Perplexity, Google AI Overviews가 어떤 페이지든 크롤링하고 읽고 인용할 수 있는지 크롤러별로 확인하고 해결 방법까지 알려 드립니다. 무료, 가입 불필요.",
	faq: [
		{
			q: "사이트는 어떻게 검사하나요?",
			a: "주소 앞에 citable.flisk.si/를 붙이세요. 예: citable.flisk.si/example.com, 또는 citable.flisk.si/example.com/pricing 같은 개별 페이지.",
		},
		{
			q: "Citable은 어떤 AI 크롤러를 확인하나요?",
			a: "답변을 만들기 위해 페이지를 가져오는 크롤러입니다: OAI-SearchBot과 ChatGPT-User, Claude-SearchBot과 Claude-User, PerplexityBot, Googlebot, Bingbot. GPTBot, ClaudeBot, Google-Extended, CCBot 같은 학습용 크롤러는 차단도 정당한 선택이므로 따로 표시하고 점수에는 넣지 않습니다.",
		},
		{
			q: "Citable은 AI를 사용하나요?",
			a: "아니요. 모든 검사는 결정적입니다: robots.txt, 응답 헤더, 그리고 JavaScript를 실행하지 않는 크롤러가 보는 HTML만 읽습니다. 'ChatGPT에 물어보기'와 'Claude에 물어보기' 버튼은 수정 목록을 여러분의 어시스턴트에게 넘겨 줄 뿐입니다.",
		},
		{
			q: "API나 MCP 서버가 있나요?",
			a: "네: /api/check?url=example.com 은 JSON으로 답하고, /badge/example.com.svg 는 README용 배지이며, /mcp 는 읽기 전용 도구 check_site 하나를 가진 MCP 서버입니다. 모두 키가 필요 없습니다.",
		},
		{
			q: "무엇이 저장되나요?",
			a: "디스크에는 아무것도 저장하지 않습니다. 공유 링크가 사이트를 다시 가져오지 않도록 리포트를 한 시간 동안 메모리에만 두었다가 잊어버립니다.",
		},
	],
	navHow: "작동 방식",
	navAbout: "소개",
	addressLabel: "사이트 주소",
	check: "검사",
	footerNote:
		"AI 크롤러처럼 페이지를 읽습니다: JavaScript 없이, 모델 없이, 아무것도 저장하지 않고.",
	footerOpen: "오픈 소스",
	footerBuilt: "제작 및 운영:",
	footerAbout: "검사기 소개",
	footerGrow: "다음 단계: 첫 고객 만나기",
	pill: "오픈 소스 · MCP 서버 제공",
	h1Before: "AI 답변이 내 사이트를 ",
	h1Em: "인용",
	h1After: "할 수 있을까요?",
	lede: (host) =>
		`어떤 주소든 앞에 <b>${host}/</b>를 붙이세요. Citable이 AI 크롤러처럼 페이지를 읽고, 답변에서 빠지는 이유와 해결 방법을 알려 드립니다.`,
	note: "<b>●</b> 몇 초 만에 무료 점수 · 가입 불필요 · 저장 없음",
	tryLabel: "예시",
	enginesLabel: "크롤러별로 확인하는 대상:",
	sample: {
		aria: "샘플 리포트",
		label: "샘플 리포트",
		score: "100점 만점에 41점",
		grade: "D등급",
		summary: "수정할 항목 3개, 최대 34점 상승 가능",
		rows: [
			[
				"AI 크롤러 허용",
				"+18",
				"robots.txt가 OAI-SearchBot과 Claude-SearchBot을 차단합니다",
			],
			[
				"JavaScript 없이 읽기 가능",
				"+11",
				"스크립트 실행 전 HTML에는 40단어뿐입니다",
			],
			["llms.txt", "+5", "/llms.txt 에서 찾을 수 없습니다"],
			[
				"제목과 설명",
				"10 / 10",
				"둘 다 있으며 검색 엔진이 보여 주는 길이입니다",
			],
		],
	},
	stats: [
		["10", "인용 여부를 좌우하는 정도에 따라 가중치를 준 검사"],
		["", "답변 엔진 크롤러를 하나씩 확인"],
		["4", "요청은 최대 네 번, 모두 GET"],
		["0", "계정, 모델, 저장된 페이지"],
	],
	filmKicker: "직접 보기",
	filmTitle: "주소 입력부터 수정까지 23초.",
	filmSub:
		"접두사를 붙이고, 점수를 확인하고, 수정 방법을 열고, 전체 목록을 내 AI에게 넘겨 보세요.",
	filmCaption:
		"23초 영상: 브라우저에서 stripe.com 앞에 citable.flisk.si/ 를 입력하면 리포트가 100점 만점에 96점을 매기고, 화면이 한 검사와 그 수정 방법으로 이동하며, 'Claude에 물어보기'를 누르면 수정 목록이 내 AI에게 전달됩니다.",
	howKicker: "작동 방식",
	howTitle: "주소 하나, 정직한 리포트 하나.",
	howSub:
		"계정도, 브라우저 확장 프로그램도, 모델의 추측도 없습니다. Citable은 크롤러가 가져오는 것을 가져와 크롤러와 같은 방식으로 읽습니다.",
	steps: [
		[
			"아무 주소 앞에 붙이기",
			"citable.flisk.si/your-site.com 처럼 입력하거나 위 입력란에 붙여 넣으세요. 홈페이지뿐 아니라 모든 페이지가 됩니다.",
		],
		[
			"크롤러처럼 읽기",
			"페이지, robots.txt, llms.txt, 사이트맵을 JavaScript 없이, 일곱 개 답변 크롤러가 보는 그대로 읽습니다.",
		],
		[
			"인용을 막는 문제 고치기",
			"각 문제마다 정확한 수정 방법과 목록을 내 AI에게 넘기는 버튼이 함께 나옵니다.",
		],
	],
	afterFixes: "수정 후",
	checksKicker: "검사 항목",
	checksTitle: "열 가지 검사, 100점 만점.",
	checksSub:
		"각 항목이 답변 엔진이 내 사이트를 인용할 수 있는지를 얼마나 좌우하는지에 따라 가중치를 둡니다.",
	checks: [
		["AI 크롤러 허용", "답변 엔진별 크롤러마다 robots.txt를 따로 읽습니다."],
		[
			"색인 및 인용 가능",
			"상태 코드, HTTPS, 그리고 페이지나 헤더에 noindex·nosnippet이 없는지 확인합니다.",
		],
		[
			"JavaScript 없이 읽기 가능",
			"텍스트가 나중에 그려지는 것이 아니라 서버가 보내는 HTML에 들어 있어야 합니다.",
		],
		[
			"제목과 설명",
			"있어야 하며, 검색 엔진이 인용 옆에 보여 주는 길이여야 합니다.",
		],
		["구조화 데이터", "페이지가 무엇인지 알려 주는 schema.org JSON-LD."],
		["제목 구조", "h1은 하나, 그리고 엔진이 따로 인용할 수 있는 h2 섹션."],
		["표준 주소", "페이지당 주소 하나, 그래야 인용이 합산됩니다."],
		["사이트맵", "robots.txt에 등록되어 크롤러가 모든 페이지를 찾도록 합니다."],
		["llms.txt", "언어 모델을 위해 작성한 사이트 요약 지도."],
		[
			"응답 시간",
			"첫 바이트까지의 시간으로, 제한된 예산으로 움직이는 크롤러가 신경 씁니다.",
		],
	],
	mcpKicker: "내 AI에서",
	mcpTitle: "어시스턴트에게 바로 물어보세요.",
	mcpSub:
		'Citable은 MCP 서버이기도 합니다. 한 번 추가한 뒤 "AI가 example.com을 인용할 수 있어?"라고 물어보세요.',
	couldNotCheck: (host) => `${host}: 검사할 수 없음`,
	couldNotCheckDescription: (host) =>
		`Citable이 ${host}을(를) 읽지 못해 ChatGPT, Claude, Perplexity, Google AI가 인용할 수 있는지 알 수 없습니다.`,
	couldNotRead: (error) => `페이지를 읽을 수 없습니다: ${error}.`,
	reportTitle: (host, score) => `${host}: AI 검색 ${score}/100`,
	reportDescription: (host, score, grade, fixes) =>
		`ChatGPT, Claude, Perplexity, Google AI가 ${host}을(를) 인용할 수 있을까요? ${score}/100점, ${grade}등급, 수정할 항목 ${fixes}개와 각각의 해결 방법.`,
	scoreAria: (score) => `100점 만점에 ${score}점`,
	grade: "등급",
	nothingToFix: "✓ 수정할 항목 없음",
	toFix: (n, worth) =>
		`수정할 항목 ${n}개${worth > 0 ? `, 최대 ${worth}점 상승 가능` : ""}`,
	checkedAt: (when) => `${when} UTC에 검사`,
	checkAgain: "다시 검사",
	answerEngines: "답변 엔진",
	allowedOf: (a, t) => `${t}개 중 ${a}개 허용`,
	allowed: "허용",
	blocked: "차단",
	training: (a, b) =>
		`학습용 크롤러: ${a}개 허용, ${b}개 차단. 답변의 인용 여부에는 영향이 없으므로 점수에 넣지 않습니다.`,
	partial: (status) =>
		`부분 리포트: 페이지가 ${status}(으)로 응답해 내용은 검사하지 못했습니다.`,
	fixFirst: "먼저 수정",
	howToFix: "해결 방법",
	details: "자세히",
	ctaTitle: "내 AI로 고치기",
	ctaText:
		"Citable은 모델을 호출하지 않습니다. 정확한 수정 방법이 담긴 목록을 내 AI에게 넘기세요.",
	askChatGpt: "ChatGPT에 물어보기",
	askClaude: "Claude에 물어보기",
	handedText: "전달되는 텍스트",
	passing: "통과",
	notes: "참고",
	shareTitle: "점수 공유하기",
	shareText:
		"링크와 함께 새 탭에서 해당 네트워크가 열립니다. Citable은 아무것도 받지 않습니다.",
	badgeTitle: "점수 배지 달기",
	badgeHint: "코드를 클릭하면 선택됩니다",
	badgeAlt: (score) => `AI 검색 점수 ${score}`,
	pointsByCheck: "검사별 점수",
	checksByWeight: (n) => `검사 ${n}개, 가중치순`,
	splitLabel: { pass: "통과", warn: "개선 필요", fail: "수정 필요" },
	status: { pass: "통과", warn: "개선", fail: "수정", info: "참고" },
	fixPrompt: (url, score) =>
		`Citable이 ${url}을(를) AI 검색 기준으로 검사했습니다(점수 ${score}/100). 중요한 것부터 순서대로, 바꿔야 할 정확한 코드나 설정과 함께 고치도록 도와주세요. 한국어로 답해 주세요:`,
	fixLine: "권장 수정",
	shareMessage: (host, score) =>
		`${host}의 AI 검색 점수는 ${score}/100입니다. ChatGPT, Claude, Perplexity가 인용할 수 있을까요?`,
	shareSubject: (host, score) => `${host}: AI 검색 ${score}/100`,
	aboutTitle: "검사기 소개",
	aboutDescription:
		"Citable이 AI 검색을 위해 사이트를 검사하는 방법: 무엇을 가져오는지, 어떤 크롤러를 보내는지, 무엇을 저장하는지, 자주 묻는 질문.",
	aboutCrumb: "소개",
	aboutKicker: "소개",
	aboutH1: "검사기는 이렇게 작동합니다",
	aboutBody: (base) => [
		`검사 한 번마다 Citable은 사이트에서 최대 네 개의 주소를 가져옵니다: 해당 페이지, <code>/robots.txt</code>, <code>/llms.txt</code>, 사이트맵. <code>CitableBot/1.0 (+${base}/about)</code> 으로 자신을 밝히고, GET 요청만 보내며, 리다이렉트는 최대 다섯 번 따라가고, 최대 2MB까지 읽고, 80번과 443번 포트의 공개 주소에만 접근합니다.`,
		`리포트는 공유 링크가 사이트를 다시 가져오지 않도록 한 시간 동안 메모리에 보관했다가 잊어버립니다. 디스크에는 아무것도 저장하지 않으며 데이터베이스도 계정도 없습니다.`,
		`robots 규칙은 RFC 9309에 따라 읽습니다: 크롤러를 지정한 그룹, 없으면 <code>*</code> 그룹, 그리고 가장 길게 일치하는 규칙. Citable은 다른 크롤러인 척하지 않으므로, 일부 user agent를 막는 방화벽은 실제 크롤러를 다르게 취급할 수 있습니다.`,
	],
	aboutQuestions: "자주 묻는 질문",
};

export const COPY: Record<Lang, Copy> = { en, ko };

/** The Korean names of the report's check titles, which checks.ts writes in English. */
const KO_CHECK_TITLES: Record<string, string> = {
	"AI answer engines can crawl the page":
		"AI 답변 엔진이 페이지를 크롤링할 수 있음",
	"Model training crawlers": "모델 학습용 크롤러",
	"The page can be indexed and quoted": "페이지를 색인하고 인용할 수 있음",
	"Readable without JavaScript": "JavaScript 없이 읽기 가능",
	"Title and description": "제목과 설명",
	"Structured data (schema.org)": "구조화 데이터 (schema.org)",
	Headings: "제목 구조",
	"Canonical address": "표준 주소",
	Sitemap: "사이트맵",
	"llms.txt": "llms.txt",
	"Response time": "응답 시간",
};

export const checkTitle = (lang: Lang, title: string): string =>
	lang === "ko" ? (KO_CHECK_TITLES[title] ?? title) : title;

/** The path prefix a language's pages live under: Korean is under /ko, English at the root. */
export const pfx = (lang: Lang): string => (lang === "ko" ? "/ko" : "");
