# CantonLink Community MCP server

An [MCP](https://modelcontextprotocol.io) server that gives AI assistants read-only access to this project's spoken-Cantonese library.

```sh
npm install --prefix mcp      # from the repository root
node mcp/server.mjs           # runs over stdio; apps start it for you
npm run inspect --prefix mcp  # try it by hand in the MCP Inspector
npm test --prefix mcp         # automated tests
```

| Kind | Name | What it does |
|---|---|---|
| Tool | `search_vocabulary` | Find words by English, Jyutping, Yale or characters |
| Tool | `list_grammar_patterns` | List patterns, optionally by level |
| Tool | `get_grammar_pattern` | One pattern with examples and common mistakes |
| Tool | `romanise_jyutping` | Convert Jyutping to Yale and Bopomofo, validating each syllable |
| Tool | `check_spoken_cantonese` | Flag written-Chinese forms in text meant to be spoken |
| Tool | `get_practice_questions` | Quiz questions, with answers held back |
| Resource | `cantonlink://about` | What the library contains and its review status |
| Resource | `cantonlink://grammar/{id}` | A grammar pattern as Markdown |
| Resource | `cantonlink://vocabulary/{topic}` | A vocabulary topic as Markdown |
| Prompt | `cantonese_tutor` | Start a grounded conversation lesson |
| Prompt | `explain_pattern` | Explain one pattern, then quiz on it |

Setup for Claude Code, VS Code, Cursor and Claude Desktop, and a walkthrough of the code, are in the **[MCP guide](../docs/MCP_GUIDE.md)**.

The server reads `dist/cantonlink-community.json`, so it always serves the current library. Run `npm run build` in the repository root after changing content.
