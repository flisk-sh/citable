// Bun's HTMLRewriter for Node, on html-rewriter-wasm. Both are lol-html, so a page parses the same in the CLI as on
// citable.flisk.si. Only what html.ts uses: on(), onDocument() and transform(response).text().
import {
	type DocumentHandlers,
	type ElementHandlers,
	HTMLRewriter as WasmRewriter,
} from "html-rewriter-wasm";

export class NodeHTMLRewriter {
	private elements: [string, ElementHandlers][] = [];
	private documents: DocumentHandlers[] = [];

	on(selector: string, handlers: ElementHandlers): this {
		this.elements.push([selector, handlers]);
		return this;
	}

	onDocument(handlers: DocumentHandlers): this {
		this.documents.push(handlers);
		return this;
	}

	transform(response: Response): { text(): Promise<string> } {
		return {
			text: async () => {
				const out: Uint8Array[] = [];
				const rewriter = new WasmRewriter((chunk) => {
					out.push(chunk);
				});
				for (const [selector, handlers] of this.elements)
					rewriter.on(selector, handlers);
				for (const handlers of this.documents) rewriter.onDocument(handlers);
				try {
					await rewriter.write(new Uint8Array(await response.arrayBuffer()));
					await rewriter.end();
				} finally {
					rewriter.free();
				}
				return new TextDecoder().decode(Buffer.concat(out));
			},
		};
	}
}

/** Installs the Node rewriter where the runtime has none of its own; Bun keeps its native one. */
export function installRewriter(): void {
	const g = globalThis as { HTMLRewriter?: unknown };
	g.HTMLRewriter ??= NodeHTMLRewriter;
}
