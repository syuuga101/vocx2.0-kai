const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const { generateDataBundle } = require('./build-data.cjs');
const root = path.resolve(__dirname, '..');
const bundled = fs.readFileSync(path.join(root, 'data.js'), 'utf8').replace(/\r\n/g, '\n');
assert.equal(bundled, generateDataBundle(), 'bundled lesson data must match CSV/JSON sources');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let writes = 0, now = 0, text = '';
const timer = { get textContent() { return text; }, set textContent(value) { writes++; text = value; } };
const clock = { currentSession: {}, performance: { now: () => now }, document: {getElementById: () => timer}, setInterval(fn, ms) { assert.equal(ms, 1000); }, clearInterval() {} };
vm.createContext(clock);
vm.runInContext(js.slice(js.indexOf('  let studyClock'), js.indexOf('  function loadState')), clock);
clock.startQuestionClock();
for (now of [100, 250, 500, 750]) clock.recordStudyTime();
assert.equal(writes, 1, 'unchanged timer labels do not write to DOM');
now = 1234; clock.stopStudyClock(); assert.equal(clock.currentSession.questionTimeMs, 1234);

function worker({ failInstall = false } = {}) {
  const handlers = {}, entries = new Map(), deleted = [], lifetimes = [];
  let networkCalls = 0, offline = false, skipped = false;
  const url = input => typeof input === 'string' ? new URL(input, 'http://localhost/').href : input.url;
  const cache = { async addAll(assets) { if (failInstall) throw Error('missing asset'); for (const asset of assets) assert(fs.existsSync(path.join(root, asset))); }, async match(request) { return entries.get(url(request))?.clone(); }, async put(request, response) { entries.set(url(request), response.clone()); } };
  const currentCache = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const CACHE_NAME = '([^']+)'/)[1];
  const c = { URL, self: {location: {origin: 'http://localhost'}, addEventListener: (name, fn) => handlers[name] = fn, skipWaiting() { skipped = true; }, clients: {claim() {}} }, caches: {open: async () => cache, keys: async () => ['another-app', 'vocx-dojo-pwa-v1', currentCache], delete: async key => deleted.push(key)}, fetch: async () => { networkCalls++; if (offline) throw Error('offline'); return new Response('network'); } };
  vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), c);
  async function fetchPath(file) { let response; handlers.fetch({request: new Request('http://localhost/' + file), waitUntil: p => lifetimes.push(p), respondWith: p => response = p}); const result = await response; await Promise.all(lifetimes.splice(0)); return result.text(); }
  return {handlers, entries, deleted, fetchPath, get networkCalls() {return networkCalls;}, get skipped() {return skipped;}, set offline(value) {offline = value;} };
}
(async () => {
  const w = worker(); let pending;
  w.handlers.install({waitUntil: p => pending = p}); await pending; assert(w.skipped);
  w.handlers.activate({waitUntil: p => pending = p}); await pending;
  assert.deepEqual(w.deleted, ['vocx-dojo-pwa-v1'], 'unrelated caches must survive');
  w.entries.set('http://localhost/sys/icon.svg', new Response('cached icon'));
  assert.equal(await w.fetchPath('sys/icon.svg'), 'cached icon'); assert.equal(w.networkCalls, 0);
  assert.equal(await w.fetchPath('app.js'), 'network'); assert.equal(w.networkCalls, 1);
  w.offline = true; assert.equal(await w.fetchPath('app.js'), 'network');
  await assert.rejects(w.fetchPath('missing.js'), /offline/);
  const broken = worker({failInstall: true}); broken.handlers.install({waitUntil: p => pending = p});
  await assert.rejects(pending, /missing asset/); assert(!broken.skipped, 'failed install cannot replace working worker');
  console.log('OK: source/bundle parity, timer writes, cache-first assets, live code/offline fallback and safe worker activation');
})().catch(error => {console.error(error); process.exitCode = 1;});
