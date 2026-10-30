# cantonlink-mcp

Learn spoken Hong Kong Cantonese from your AI assistant or your terminal. An [MCP](https://modelcontextprotocol.io) server and a small CLI over the [CantonLink Community](https://github.com/jyltsang/Cantonlink-community) library: 63 grammar patterns, 390 words, Jyutping, Yale and Bopomofo.

## Use it with an AI assistant

Add it to any MCP app (Claude Code, Claude Desktop, VS Code, Cursor and others) with the command `npx` and the arguments `-y cantonlink-mcp`. For example, in Claude Desktop's `claude_desktop_config.json`:

```json
{ "mcpServers": { "cantonlink": { "command": "npx", "args": ["-y", "cantonlink-mcp"] } } }
```

or in Claude Code:

```sh
claude mcp add --transport stdio --scope user cantonlink -- npx -y cantonlink-mcp
```

Then ask: *"How do I say 'thank you' in Cantonese? Give me Jyutping and Yale."* The assistant answers from the library instead of from memory.

**Characters are off by default**, for learners who do not read them: Cantonese is shown in Jyutping (or Yale) only, and the assistant is told never to show characters. Add `--romanisation=yale` to show Yale first, or `--characters=on` to show characters; the variables `CANTONLINK_ROMANISATION` and `CANTONLINK_CHARACTERS` do the same. Search accepts romanisation without tones, run together, or spelt as learners hear it (`lei hou`, `mgoi`).

## Use it in the terminal

```sh
npx -p cantonlink-mcp cantonlink word              # word of the day
npx -p cantonlink-mcp cantonlink word "deadline"   # look a word up
npx -p cantonlink-mcp cantonlink quiz --level A1   # fill-the-gap quiz
npx -p cantonlink-mcp cantonlink romanise "nei5 hou2"
```

Or `npm install -g cantonlink-mcp` and type `cantonlink quiz`.

## What the server offers

| Kind | Name | What it does |
|---|---|---|
| Tool | `search_vocabulary` | Find words by English, Jyutping or Yale (tones optional) or characters |
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

Setup for every app, a walkthrough of the code and a checklist for building your own server are in the **[MCP guide](https://github.com/jyltsang/Cantonlink-community/blob/main/docs/MCP_GUIDE.md)**. All tools are read-only and work offline.

## Developing

From a clone of the repository:

```sh
npm install --prefix mcp      # from the repository root
node mcp/server.mjs           # runs over stdio; apps start it for you
node mcp/cli.mjs quiz         # the terminal tool
npm run inspect --prefix mcp  # try the server by hand in the MCP Inspector
npm test --prefix mcp         # automated tests, including packing and running the package
```

In the repository the server reads `../dist/cantonlink-community.json` and `../tools/`, so it always serves the current library; run `npm run build` in the repository root after changing content. `npm pack` bundles copies of both into `vendor/`.

## Licence

Code MIT. Library content [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (included as `vendor/LICENSE-CONTENT`). Content is a draft awaiting native-speaker review; please [report anything unnatural](https://github.com/jyltsang/Cantonlink-community/issues/new?template=content-error.yml).
