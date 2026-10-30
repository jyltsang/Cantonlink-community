# Connect an AI assistant to Cantonese lessons with MCP

This guide shows how to give an AI assistant (Claude, GitHub Copilot, Cursor and others) access to this project's reviewed Cantonese library through the **Model Context Protocol (MCP)**. It also explains how the server is built, so you can make your own.

**You will learn:**
- what MCP is, and its three building blocks: tools, resources and prompts
- how to connect a ready-made MCP server to the app you already use
- how the server's code works, and the practices that make an MCP server reliable and safe
- how to test an MCP server automatically

**You need:** [Node.js 22 or later](https://nodejs.org), [Git](https://git-scm.com), and an MCP-capable app. Setup takes about 15 minutes.

---

## 1. MCP in two minutes

AI models only know what they were trained on and what is in the conversation. MCP is an open standard that lets an AI app plug into outside tools and data in a uniform way. You can think of it as a USB-C port for AI: one connector, many devices.

```
 ┌───────────── Host app ─────────────┐                ┌──────── MCP server ────────┐
 │  Claude Desktop, VS Code, Cursor…  │   JSON-RPC     │  this project's mcp/        │
 │                                    │ ◄────────────► │                             │
 │  AI model  ◄──►  MCP client        │  stdio or HTTP │  tools · resources · prompts│
 └────────────────────────────────────┘                └──────────────┬──────────────┘
                                                                      │ reads
                                                       dist/cantonlink-community.json
```

- The **host** is the app you chat in. It contains an **MCP client** for each server it connects to.
- The **server** is a small program that offers capabilities. It never talks to the model directly; the host decides what to show the model.
- The **transport** is how they talk. **stdio** means the host starts the server as a local process and they exchange messages over standard input and output; it's the simplest option and what this guide uses. **Streamable HTTP** runs the server as a web service, for remote or shared use.

A server can offer three kinds of capability:

| Building block | Who uses it | What it is | In this project |
|---|---|---|---|
| **Tools** | The model decides when to call them | Functions with typed inputs, like an API | `search_vocabulary`, `get_grammar_pattern`, `romanise_jyutping`, `check_spoken_cantonese`, `list_grammar_patterns`, `get_practice_questions` |
| **Resources** | The app or the user attaches them | Read-only documents identified by a URI | `cantonlink://grammar/{id}`, `cantonlink://vocabulary/{topic}`, `cantonlink://about` |
| **Prompts** | The user picks them, often from a menu or slash command | Reusable conversation templates with arguments | `cantonese_tutor`, `explain_pattern` |

## 2. Why connect an assistant to this library?

General-purpose AI models are fluent in Mandarin and written Chinese, but often make mistakes in spoken Cantonese. Typical errors are 他是 instead of 佢係, invented or wrong Jyutping tones, and Yale written inconsistently. Connecting the library lets the assistant:

- **look things up** in a reviewed vocabulary and grammar library, instead of relying on memory
- **convert romanisation correctly**: the Yale and Bopomofo converter is tested against every Jyutping syllable
- **check its own Cantonese** for written-Chinese forms before showing it to a learner
- **quiz you** with real practice questions, holding the answers back until you reply

This pattern is called **grounding**: the model reasons and converses, while the facts come from a source you can check.

## 3. Install the server

There are two ways. Most people only need the first.

**Option A: no installation (recommended).** Apps start the server with `npx`, which downloads the [`cantonlink-mcp`](https://www.npmjs.com/package/cantonlink-mcp) package the first time and runs it. You only need [Node.js](https://nodejs.org) 22 or later. Check it runs:

```sh
npx -y cantonlink-mcp
```

**Option B: from a clone**, if you want to read or change the code:

```sh
git clone https://github.com/jyltsang/Cantonlink-community.git
cd Cantonlink-community
npm install --prefix mcp
node mcp/server.mjs
```

Either way you should see `CantonLink Community MCP server running on stdio`, and then nothing more: it is waiting for an app to talk to it. Press Ctrl+C to stop it.

**Try it before connecting an AI.** The official **MCP Inspector** is a web page for calling tools by hand. It is the best way to learn what a server does:

```sh
npx @modelcontextprotocol/inspector@2.10.1 npx -y cantonlink-mcp   # Option A
npm run inspect --prefix mcp                                         # Option B
```

Open the address it prints, select **Connect**, then explore the **Tools**, **Resources** and **Prompts** tabs. Try `romanise_jyutping` with `nei5 hou2`, or `check_spoken_cantonese` with `他是我的朋友`.

### Bonus: learn in the terminal

The same package includes a small command-line tool, `cantonlink`, for quick practice without an AI:

```sh
npx -p cantonlink-mcp cantonlink word            # word of the day
npx -p cantonlink-mcp cantonlink word "thank you"
npx -p cantonlink-mcp cantonlink quiz --level A1 # fill-the-gap quiz, answered by number
npx -p cantonlink-mcp cantonlink romanise "nei5 hou2"
```

Install it once with `npm install -g cantonlink-mcp` to type just `cantonlink quiz`. From a clone, run `node mcp/cli.mjs quiz`.

## 4. Connect it to your app

Each example shows Option A. For Option B, use the command `node` with the argument `/path/to/Cantonlink-community/mcp/server.mjs` instead, replacing `/path/to/Cantonlink-community` with the folder you cloned into. On Windows, write paths with forward slashes, e.g. `C:/Users/you/Cantonlink-community/mcp/server.mjs`.

### Claude Code

```sh
claude mcp add --transport stdio --scope user cantonlink -- npx -y cantonlink-mcp
```

Check it with `claude mcp list`, or with `/mcp` inside a session. If you open Claude Code **inside the cloned folder**, it is already set up: the project's [`.mcp.json`](../.mcp.json) declares the server, and Claude Code asks you to approve it the first time.

### VS Code (GitHub Copilot agent mode)

Add this to your project's `.vscode/mcp.json`, or to your user settings with **MCP: Open User Configuration**. Note that VS Code uses `servers`, not `mcpServers`:

```json
{
  "servers": {
    "cantonlink": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "cantonlink-mcp"]
    }
  }
}
```

Select **Start** above the server entry, then switch Copilot Chat to **Agent** mode. In the cloned folder, [`.vscode/mcp.json`](../.vscode/mcp.json) already declares the server.

### Cursor

Put the same entry as Claude Desktop (below) in `~/.cursor/mcp.json` to make it available in every project, then check **Cursor Settings → MCP**. In the cloned folder, [`.cursor/mcp.json`](../.cursor/mcp.json) already declares the server.

### Claude Desktop

1. Open **Settings → Developer → Edit Config**. This opens `claude_desktop_config.json`, found at `~/Library/Application Support/Claude/` on macOS or `%APPDATA%\Claude\` on Windows.
2. Add the server:
   ```json
   {
     "mcpServers": {
       "cantonlink": {
         "command": "npx",
         "args": ["-y", "cantonlink-mcp"]
       }
     }
   }
   ```
3. Save the file and **quit and reopen** Claude Desktop completely. The tools then appear under the tools menu in the message box.

### Other apps

Any MCP-capable app works the same way. Find where it keeps its MCP settings and give it the command `npx` with the arguments `-y cantonlink-mcp`. Most apps use the `mcpServers` format shown for Claude Desktop.

### Characters and romanisation

The server is built first for learners who do not read Chinese characters. By default, **characters are off**. Tool results, resources and prompts show Cantonese in Jyutping with Yale beside it, and the server tells the model never to show characters, not even inside explanations. Forms that only make sense in characters (the written-Chinese equivalent of a pattern, the "avoid" sentence, the spoken-or-written quiz) are left out, as they are on the website with characters off.

Two options change this. Add them after `cantonlink-mcp` in the arguments, or set the environment variables if your app only passes those:

| Argument | Environment variable | Values | Default |
|---|---|---|---|
| `--romanisation=yale` | `CANTONLINK_ROMANISATION` | `jyutping`, `yale` | `jyutping` |
| `--characters=on` | `CANTONLINK_CHARACTERS` | `off`, `on` | `off` |

For example, Yale first, in Claude Desktop:

```json
{ "mcpServers": { "cantonlink": { "command": "npx", "args": ["-y", "cantonlink-mcp", "--romanisation=yale"] } } }
```

or in Claude Code:

```sh
claude mcp add --transport stdio --scope user cantonlink -- npx -y cantonlink-mcp --romanisation=yale
```

`check_spoken_cantonese` still takes Chinese text. With characters off, the model writes its Cantonese in characters only to check it, then shows you the romanisation.

**Typing romanisation.** `search_vocabulary` accepts the way learners actually type. Tones are optional: `m goi`, `m4 goi1`, `mh goi` and `m̀h gōi` all find the same word. It also accepts Yale with or without its marks, syllables run together (`neihou`), and l for n (`lei hou`). A tone you do give must match. When only a different tone or a one-letter slip connects your query to a word, the result is labelled as a closest match. Hong Kong street spellings such as `cha siu bao` are not yet recognised.

## 5. Try it

Ask in plain language. The model chooses which tools to call:

- *"How do I say 'thank you' in Cantonese? Give me Jyutping and Yale."*
- *"Explain the difference between 咗 and 過 using the library's examples."*
- *"Quiz me with five A1 fill-the-gap questions. Wait for my answers before marking them."*
- *"Is this natural spoken Cantonese: 我不知道他在哪裏?"*
- *"Convert 'ngo5 sik6 zo2 faan6 laa3' to Bopomofo."*

Then try the **prompt templates**. In apps that show them, they appear in a prompt menu or as slash commands (in Claude Code, for example, as `/mcp__cantonlink__cantonese_tutor`). `cantonese_tutor` starts a short lesson at your level, on a scenario you choose, and tells the model to check its Cantonese with the library before replying.

You can also **attach a resource**, such as `cantonlink://vocabulary/food-and-dim-sum`, so the whole word list goes into the conversation as context.

## 6. How the server works

The server is built from three main files, kept apart on purpose:

| File | Role |
|---|---|
| [`tools/library.mjs`](../tools/library.mjs) | Ordinary functions: search, formatting, romanisation, the written-Chinese check, practice questions. No MCP code at all, and no Node-only APIs. |
| [`tools/tool-definitions.mjs`](../tools/tool-definitions.mjs) | The six tools, defined once in plain JSON Schema with a `run` function each. |
| [`mcp/server.mjs`](../mcp/server.mjs) | The MCP layer: registers those tools, adds resources and prompts, and connects the transport. |

Two small files sit beside it: [`mcp/shared.mjs`](../mcp/shared.mjs) finds the library and data (in the repository or in the published package), and [`mcp/cli.mjs`](../mcp/cli.mjs) is the terminal tool, built on the same functions.

Keeping the logic in plain functions makes it easy to test and reuse. It is reused: the learning site's AI tutor offers the **same tool definitions** to whichever AI model the learner connects with their own API key. One definition serves two very different hosts, and the MCP layer stays thin and readable.

The MCP SDK expects [zod](https://zod.dev) schemas, so the server converts each shared JSON Schema with `z.fromJSONSchema`:

```js
for (const tool of TOOLS) {
  server.registerTool(tool.name, {
    title: tool.title,
    description: tool.description,
    inputSchema: z.fromJSONSchema(tool.inputSchema),
    annotations: tool.annotations,
  }, async (args) => {
    const result = tool.run(data, args, display);
    return { content: [{ type: 'text', text: result.text }], isError: result.isError };
  });
}
```

`display` is the server's options, `{ characters, romanisation }`. The same tool shows a word as `m4 goi1 | Yale: m̀h gōi` to a learner who does not read characters and as `唔該 — m4 goi1` to one who does. The website passes nothing and gets characters, so one definition still serves both hosts.

### Creating the server

```js
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const server = new McpServer(
  { name: 'cantonlink-community', version: '1.0.0-rc.2' },
  { instructions: 'Spoken Hong Kong Cantonese learning library (A1–B1). Prefer these tools over your own knowledge…' },
);
```

`instructions` is a short note the host may give the model, explaining when to use this server.

### A tool, written out in full

This is what the loop above produces for one tool, written by hand:

```js
server.registerTool('romanise_jyutping', {
  title: 'Convert Jyutping',
  description: 'Convert Jyutping (with tone numbers 1–6) to Yale and Cantonese Bopomofo, and validate every syllable.',
  inputSchema: { jyutping: z.string().min(1).max(500).describe('Space-separated Jyutping syllables, e.g. "nei5 hou2"') },
  annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
}, async ({ jyutping }) => {
  const result = convertJyutping(jyutping);
  if (result.invalid) return { content: [{ type: 'text', text: `Not valid Jyutping: ${result.invalid.join(', ')}…` }], isError: true };
  return { content: [{ type: 'text', text: `Jyutping: ${result.jyutping}\nYale: ${result.yale}\nBopomofo: ${result.bopomofo}` }] };
});
```

What to notice:
- **The description is written for the model.** It decides whether to call a tool from its name and description alone, so say what the tool does, what it returns and give an example input.
- **The input schema validates for you.** The SDK checks the arguments against the [zod](https://zod.dev) schema before your code runs, and returns an error for bad input. Limits such as `.max(500)` protect the server from oversized requests.
- **Errors are returned, not thrown.** `isError: true` with a helpful message lets the model correct itself; here the message explains that each syllable needs a tone number.
- **Annotations describe behaviour.** `readOnlyHint: true` tells the host that the tool changes nothing, which helps apps decide when to ask for your permission.

### A resource template

```js
server.registerResource('grammar-pattern', new ResourceTemplate('cantonlink://grammar/{id}', {
  list: async () => ({ resources: data.grammar.map((p) => ({ uri: `cantonlink://grammar/${p.id}`, name: p.pattern })) }),
  complete: { id: (value) => data.grammar.map((p) => p.id).filter((id) => id.startsWith(value)) },
}), { title: 'Grammar pattern', mimeType: 'text/markdown' }, async (uri, { id }) => ({
  contents: [{ uri: uri.href, mimeType: 'text/markdown', text: formatPattern(findPattern(data, id)) }],
}));
```

One template covers all 63 patterns. `list` lets apps show them in a picker, and `complete` offers autocompletion as you type an id.

### A prompt

```js
server.registerPrompt('cantonese_tutor', {
  title: 'Cantonese tutor',
  argsSchema: { level: z.enum(['A1', 'A2', 'B1']), scenario: z.string().max(100).optional() },
}, ({ level, scenario }) => ({
  messages: [{ role: 'user', content: { type: 'text', text: `Be my Cantonese tutor for a short ${level} conversation…` } }],
}));
```

A prompt is a reusable starting message. It is the right place to encode good habits, such as "run `check_spoken_cantonese` before you reply".

### Connecting over stdio

```js
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

await server.connect(new StdioServerTransport());
console.error('CantonLink Community MCP server running on stdio');
```

> **The most common beginner bug:** with stdio, **standard output carries the protocol**. A stray `console.log` corrupts the messages and the app disconnects. Always log with `console.error`, which goes to standard error.

### Packaging it for `npx`

A server people can start with `npx -y your-package` needs three things, all visible in [`mcp/package.json`](../mcp/package.json):

1. **A `bin` entry** pointing at the server file, which starts with `#!/usr/bin/env node`. When the package name matches the command name, `npx -y cantonlink-mcp` runs it directly.
2. **Everything it needs inside the package.** Here the library and data live outside `mcp/`, so a `prepack` script ([`mcp/scripts/vendor.mjs`](../mcp/scripts/vendor.mjs)) copies them into `vendor/` just before packing, and `postpack` removes them again. The `files` list keeps tests and scripts out of the package.
3. **A start-up check that survives symlinks.** npm runs commands through a symlink in `node_modules/.bin`, so `process.argv[1]` is the link, not your file. The usual check `import.meta.url === pathToFileURL(process.argv[1]).href` is then false and the server silently does nothing. Compare against `realpathSync(process.argv[1])` instead.

[`mcp/test/pack.test.mjs`](../mcp/test/pack.test.mjs) proves all three: it runs `npm pack`, unpacks the package in an empty folder, and starts both commands through symlinks exactly as `npx` would.

## 7. Test it automatically

The SDK's in-memory transport connects a real client to your server inside one process, with no app needed. The tests in [`mcp/test/server.test.mjs`](../mcp/test/server.test.mjs) use it like this:

```js
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await createServer().connect(serverTransport);
const client = new Client({ name: 'test-client', version: '1.0.0' });
await client.connect(clientTransport);

const result = await client.callTool({ name: 'romanise_jyutping', arguments: { jyutping: 'nei5 hou2' } });
// result.content[0].text → "Jyutping: nei5 hou2\nYale: néih hóu\nBopomofo: ㄋㄝㄧ⁵ ㄏㄛㄨ²"
```

Run them with `npm test --prefix mcp`. They check every tool, resource and prompt, that invalid input is rejected, and, by starting the real process, that the server speaks correctly over stdio. They run in CI on every change.

## 8. Build your own MCP server: a checklist

1. **Start from a job, not an API.** Ask what the model needs to do for the user, then design a few tools around that. Six focused tools beat thirty thin wrappers.
2. **Name and describe tools for the model.** Use `verb_noun` names, say what each returns, and include an example input in the schema descriptions.
3. **Return compact, readable text.** Models read your output, so give them what they need rather than raw database rows. Say when there are no results, and why.
4. **Validate every input**, with types, ranges and length limits.
5. **Return errors that teach.** "No pattern with id 'zo2'. Did you mean: zo2-completed?" lets the model recover on its own.
6. **Least privilege.** Make tools read-only unless writing is the point, mark them with annotations, and never expose more files, commands or data than the job needs.
7. **Keep secrets out of code.** Pass API keys through environment variables (the `env` field in app configs), never in the repository.
8. **Treat what you return as untrusted text.** If a tool returns content from the web or from users, a model may read instructions hidden in it ("prompt injection"). Label such content clearly, and never let it trigger destructive actions without the user's confirmation.
9. **Log to stderr**, not stdout (for stdio servers).
10. **Test with the Inspector by hand, and with an in-memory client in CI.**

## 9. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| The app shows the server as failed or disconnected | Run `node /path/to/mcp/server.mjs` in a terminal and read the error. Usually the path is wrong (use an absolute path) or `npm install --prefix mcp` was not run. With `npx`, check that `node --version` is 22 or later; desktop apps may not see a Node.js installed through a version manager, in which case give the full path to `npx`. |
| `Cannot find module '@modelcontextprotocol/sdk…'` | Dependencies are missing: run `npm install --prefix mcp`. |
| `SyntaxError` or `Unexpected token` on start | Node.js is too old. Check `node --version` is 22 or later. If the app uses a different Node.js, put its full path in `command`. |
| The tools do not appear | Restart the app completely after changing its config. In VS Code, start the server from `mcp.json` and use Agent mode. In Claude Code, approve the project server when asked. |
| It worked, then broke after you edited the code | Look for a `console.log`; use `console.error` instead. |
| Answers do not use the tools | Ask explicitly ("use the CantonLink tools…"), or start with the `cantonese_tutor` prompt. |

## 10. Going further

- **Search by meaning.** To ground your own tutor with a vector index, see the [RAG guide](RAG_GUIDE.md).
- **Use it from your own code.** The same SDK includes a client (`@modelcontextprotocol/sdk/client`), so your own app can connect to this server and pass its tools to any AI model's tool-calling API.
- **Run it remotely.** For a web app, or to share one server with a team, serve it over **Streamable HTTP** instead of stdio. The SDK provides that transport too; you would then add authentication.
- **Contribute.** Ideas for new tools: spaced-repetition scheduling, a "which classifier?" quiz, or searching example sentences by pattern. Open an issue to discuss.

## Further reading

- [Model Context Protocol](https://modelcontextprotocol.io): the specification, concepts and official guides
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk): the library this server uses, with more examples
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector): the testing tool used above
- [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp) and [VS Code MCP documentation](https://code.visualstudio.com/docs/copilot/customization/mcp-servers): setup details for those apps

The server code is MIT-licensed, so copy it as a starting point for your own.
