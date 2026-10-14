// Attribute sampled querySelectorAll time to its JS callers, including calls
// shown as [unattributed] native work in DevTools. No trace contents are copied.
// node scripts/analyze-query-trace.mjs trace.json.gz [summary.json]
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const [input, output] = process.argv.slice(2);
if (!input) throw new Error('Provide a DevTools trace JSON/JSON.gz path');
const buffer = await readFile(input);
const trace = JSON.parse(input.endsWith('.gz') ? gunzipSync(buffer).toString('utf8') : buffer.toString('utf8'));
const chunks = (trace.traceEvents ?? trace).filter(event => event.name === 'ProfileChunk');
const key = event => `${event.pid}:${event.tid}:${event.id}`;
const profiles = new Map();
for (const event of chunks) {
  const nodes = profiles.get(key(event)) ?? new Map();
  for (const node of event.args.data.cpuProfile?.nodes ?? []) nodes.set(node.id, node);
  profiles.set(key(event), nodes);
}
const groups = new Map();
for (const event of chunks) {
  const nodes = profiles.get(key(event));
  const data = event.args.data;
  for (const [i, id] of (data.cpuProfile?.samples ?? []).entries()) {
    let node = nodes.get(id);
    const path = [];
    const visited = new Set();
    while (node && !visited.has(node.id)) {
      visited.add(node.id); path.push(node.callFrame); node = nodes.get(node.parent);
    }
    const query = path.findIndex(frame => frame.functionName === 'querySelectorAll');
    if (query < 0) continue;
    const caller = path.slice(query + 1).filter(frame => frame.url).slice(0, 4)
      .map(frame => {
        const file = frame.url.split('/').pop().split(/[?#]/)[0];
        return `${frame.functionName || '(anonymous)'} ${file}:${frame.lineNumber}:${frame.columnNumber}`;
      }).join(' > ') || '(no JS caller)';
    const group = groups.get(caller) ?? { caller, samples: 0, sampledMs: 0 };
    group.samples++; group.sampledMs += (data.timeDeltas?.[i] ?? 0) / 1000;
    groups.set(caller, group);
  }
}
const callers = [...groups.values()].sort((a, b) => b.sampledMs - a.sampledMs);
const summary = { method: 'CPU profile samples, inclusive querySelectorAll; source coordinates are zero-based',
  sampledMs: callers.reduce((sum, group) => sum + group.sampledMs, 0), callers };
const json = JSON.stringify(summary, null, 2);
if (output) await writeFile(output, json + '\n');
console.log(json);
