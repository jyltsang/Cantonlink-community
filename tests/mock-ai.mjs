// A scripted OpenAI-compatible server for the browser tests, so the AI tutor
// is tested end to end without real keys or costs. What it answers depends
// on the learner's last message:
//   default        → looks up a grammar pattern with a tool, then replies
//   contains FIX   → first reply has bad Jyutping; the retry is correct
//   contains BAD   → every reply has bad Jyutping (stays Unverified)
//   他是學生       → a correction to 佢係學生
//   BUSY           → HTTP 503 for the first three requests (one turn with
//                    its retries), then normal answers
import { createServer } from 'node:http';

const W = (text) => text.split(' ').map((t) => {
  const [cjk, jp = ''] = t.split('/');
  return { cjk, jyutping: jp.replaceAll('-', ' ') };
});
const reply = (words, en, extra = {}) => JSON.stringify({ reply: { words: W(words), en }, correction: null, patterns: [], note: '', ...extra });

const GREETING = reply('你好/nei5-hou2 ！ 你/nei5 食咗/sik6-zo2 飯/faan6 未/mei6 呀/aa3 ？', 'Hi! Have you eaten yet?', { patterns: ['mei6-yet'] });
const ANSWER = reply('好/hou2 呀/aa3 ！ 你/nei5 食咗/sik6-zo2 乜嘢/mat1-je5 呀/aa3 ？', 'Great! What did you eat?', { patterns: ['zo2-completed', 'mat1-je5-what'] });
const BAD = reply('你好/nei7-hou2 ！', 'Hello!');
const CORRECTION = JSON.stringify({
  reply: { words: W('你/nei5 讀/duk6 緊/gan2 書/syu1 呀/aa3 ？'), en: 'Are you studying?' },
  correction: { learner_said: '他是學生', better: { words: W('佢/keoi5 係/hai6 學生/hok6-saang1 。'), en: 'He is a student.' }, explanation: 'Use 佢 and 係 in speech; 他 and 是 are written Chinese.', pattern_id: 'hai6-copula' },
  patterns: ['gan2-progressive'],
  note: '',
});
const TRANSLATION = JSON.stringify({ words: W('早晨/zou2-san4 ！'), en: 'Good morning!' });
const EXPLANATION = JSON.stringify({ explanation: 'Use 咗 after a verb for a finished action.', examples: [{ words: W('我/ngo5 到/dou3 咗/zo2 喇/laa3 。'), en: "I've arrived." }] });

function answer(messages) {
  const last = messages.at(-1);
  const users = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const lastUser = users.at(-1) ?? '';
  const learner = [...users].reverse().find((c) => !c.startsWith('Your last answer failed')) ?? '';
  const content = (text) => ({ choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop' }] });
  if (lastUser.startsWith('Translate')) return content(TRANSLATION);
  if (lastUser.startsWith('Explain this Cantonese grammar')) return content(EXPLANATION);
  if (learner.includes('BAD')) return content(BAD);
  if (lastUser.startsWith('Your last answer failed')) return content(ANSWER);
  if (lastUser.includes('FIX')) return content(BAD);
  if (lastUser.includes('他是學生')) return content(CORRECTION);
  if (lastUser.startsWith('Start our conversation')) return content(GREETING);
  if (last.role === 'tool') return content(ANSWER);
  return {
    choices: [{
      message: { role: 'assistant', content: null, tool_calls: [{ id: `call_${messages.length}`, type: 'function', function: { name: 'get_grammar_pattern', arguments: '{"id":"zo2-completed"}' } }] },
      finish_reason: 'tool_calls',
    }],
  };
}

export function startMockAi(port) {
  const requests = [];
  let busyLeft = 3;
  const server = createServer(async (req, res) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'content-type': 'application/json' };
    if (req.method === 'OPTIONS') return res.writeHead(204, headers).end();
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ path: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null });
    if (req.url === '/v1/models') return res.writeHead(200, headers).end(JSON.stringify({ data: [{ id: 'mock-model' }, { id: 'mock-model-large' }] }));
    if (req.url === '/v1/chat/completions') {
      const { messages } = JSON.parse(body);
      if (messages.some((m) => m.role === 'user' && String(m.content).includes('BUSY')) && busyLeft-- > 0) return res.writeHead(503, headers).end(JSON.stringify({ error: { message: 'high demand' } }));
      return res.writeHead(200, headers).end(JSON.stringify(answer(messages)));
    }
    res.writeHead(404, headers).end('{}');
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, requests, close: () => server.close() })));
}
