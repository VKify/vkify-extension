// Read-only summary. Does not copy page URLs, screenshots, profile samples or
// account data into the report. The original trace remains at the supplied path.
// node scripts/analyze-style-trace.mjs trace.json.gz [summary.json]
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const [input, output] = process.argv.slice(2);
if (!input) throw new Error('Provide a DevTools trace JSON/JSON.gz path');
const buffer = await readFile(input);
const trace = JSON.parse(input.endsWith('.gz') ? gunzipSync(buffer).toString('utf8') : buffer.toString('utf8'));
const events = trace.traceEvents ?? trace;
const styles = events.filter(event => event.name === 'UpdateLayoutTree' && event.ph === 'X' && Number.isFinite(event.dur));
const groups = new Map();
for (const event of styles) {
  const frames = event.args?.beginData?.stackTrace ?? [];
  const stack = frames.slice(0, 3).map(frame => `${frame.functionName || '(anonymous)'} ${frame.url?.split('/').pop()}:${frame.lineNumber}:${frame.columnNumber}`).join(' > ') || '(deferred / no stack)';
  const group = groups.get(stack) ?? { stack, count: 0, styleMs: 0, maxAffectedElements: 0 };
  group.count++;
  group.styleMs += event.dur / 1000;
  group.maxAffectedElements = Math.max(group.maxAffectedElements, event.args?.elementCount ?? 0);
  groups.set(stack, group);
}
const counters = events.filter(event => event.name === 'UpdateCounters').map(event => event.args?.data).filter(data => Number.isFinite(data?.nodes));
const summary = {
  recordedAt: trace.metadata?.startTime,
  completeStyleEvents: styles.length,
  styleMs: styles.reduce((sum, event) => sum + event.dur / 1000, 0),
  maxStyleMs: Math.max(...styles.map(event => event.dur / 1000)),
  maxAffectedElements: Math.max(...styles.map(event => event.args?.elementCount ?? 0)),
  domCounters: counters.length ? { first: counters[0].nodes, last: counters.at(-1).nodes, max: Math.max(...counters.map(data => data.nodes)) } : null,
  hasInvalidationTracking: events.some(event => event.name === 'StyleRecalcInvalidationTracking'),
  hasSelectorStats: events.some(event => event.name === 'SelectorStats'),
  groups: [...groups.values()].sort((a, b) => b.styleMs - a.styleMs),
};
const json = JSON.stringify(summary, null, 2);
if (output) await writeFile(output, json + '\n');
console.log(json);
