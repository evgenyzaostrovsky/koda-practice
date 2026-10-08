import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const workerSource = readFileSync('apps/web/public/sandbox-worker.js', 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function boot({ failImport = false } = {}) {
  const messages = [];
  const imports = new Set();
  let releasePackages;
  const packages = new Promise(resolve => { releasePackages = resolve; });
  const runtime = {
    loadPackage: () => packages,
    runPython: code => {
      for (const module of ['numpy', 'pandas']) {
        if (new RegExp(`(?:^|\\n)import ${module}(?:\\n|$)`).test(code)) {
          if (failImport) throw new Error('core import failed');
          imports.add(module);
        }
      }
    },
  };
  const context = createContext({ performance, crypto: { randomUUID: () => 'qa-worker' }, importScripts: () => {}, loadPyodide: async () => runtime, postMessage: value => messages.push({ ...value, imported: [...imports] }), console });
  runInContext(workerSource, context);
  return { messages, releasePackages };
}

test('cold readiness waits for package loading and completed trusted core imports on every worker generation', async () => {
  for (let generation = 0; generation < 2; generation++) {
    const { messages, releasePackages } = boot();
    await tick();
    assert.equal(messages.some(message => message.type === 'ready'), false);
    assert.equal(messages.some(message => message.phase === 'running'), false);
    releasePackages();
    await tick();
    const ready = messages.find(message => message.type === 'ready');
    assert.ok(ready);
    assert.deepEqual(ready.imported.sort(), ['numpy', 'pandas']);
    assert.ok(ready.metrics.coreImportMs >= 0);
    assert.equal(messages.some(message => message.phase === 'running'), false);
  }
});

test('failed trusted core import never advertises readiness', async () => {
  const { messages, releasePackages } = boot({ failImport: true });
  releasePackages();
  await tick();
  assert.equal(messages.some(message => message.type === 'ready'), false);
  assert.match(messages.find(message => message.type === 'fatal')?.message ?? '', /core import failed/);
});
