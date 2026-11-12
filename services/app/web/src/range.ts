// Byte ranges for the how-it-works clip: Safari plays a video only from a server that answers them.
export function rangeResponse(
	body: Uint8Array<ArrayBuffer>,
	type: string,
	rangeHeader: string | undefined | null,
): Response {
	const headers: Record<string, string> = {
		"content-type": type,
		"cache-control": "public, max-age=604800",
		"accept-ranges": "bytes",
	};
	const range = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader ?? "");
	if (!range || (range[1] === "" && range[2] === ""))
		return new Response(body, { status: 200, headers });
	const start =
		range[1] === "" ? body.length - Number(range[2]) : Number(range[1]);
	const end =
		range[1] === "" || range[2] === ""
			? body.length - 1
			: Math.min(Number(range[2]), body.length - 1);
	if (start < 0 || start > end)
		return new Response(null, {
			status: 416,
			headers: { "content-range": `bytes */${body.length}` },
		});
	return new Response(body.subarray(start, end + 1), {
		status: 206,
		headers: {
			...headers,
			"content-range": `bytes ${start}-${end}/${body.length}`,
		},
	});
}
