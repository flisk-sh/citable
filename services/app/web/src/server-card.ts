// The MCP Server Card, so a client or scanner can find the /mcp server from this host's /.well-known.
import { SERVER_INFO } from "./mcp";
import { SITE } from "./site";

/** Both paths in use for the card: byte-identical answers. */
export const SERVER_CARD_PATHS = [
	"/.well-known/mcp-server-card.json",
	"/.well-known/mcp/server-card.json",
];

/** The card, with the host taken from SITE.url (the one constant for it). */
export function serverCard() {
	return {
		$schema:
			"https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
		name: "si.flisk/citable",
		title: SERVER_INFO.title,
		description:
			"Check whether AI search and chatbots can find, read and cite a website.",
		version: SERVER_INFO.version,
		websiteUrl: SITE.url,
		remotes: [{ type: "streamable-http", url: `${SITE.url}mcp` }],
	};
}

export const serverCardJson = () =>
	`${JSON.stringify(serverCard(), null, 2)}\n`;
