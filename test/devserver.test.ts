import vm from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { devReloadScript } from '../src/core/bundle';
import { startReloadServer, type ReloadServer } from '../src/core/devserver';

let server: ReloadServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

const get = async (port: number, v: string): Promise<string> =>
  (await fetch(`http://127.0.0.1:${port}/__reload?v=${v}`)).text();

describe('reload server', () => {
  it('answers a new client with the current version at once', async () => {
    server = await startReloadServer();
    expect(await get(server.port, '')).toBe('1');
  });

  it('holds a client that is up to date until bump() is called', async () => {
    server = await startReloadServer();
    let answered = false;
    const pending = get(server.port, '1').then((v) => {
      answered = true;
      return v;
    });
    await new Promise((r) => setTimeout(r, 150));
    expect(answered).toBe(false);
    server.bump();
    expect(await pending).toBe('2');
  });

  it('answers a stale client immediately and allows cross-origin reads', async () => {
    server = await startReloadServer();
    server.bump();
    const res = await fetch(`http://127.0.0.1:${server.port}/__reload?v=1`);
    expect(await res.text()).toBe('2');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('returns 404 for anything else', async () => {
    server = await startReloadServer();
    expect((await fetch(`http://127.0.0.1:${server.port}/other`)).status).toBe(404);
  });
});

describe('dev reload client', () => {
  it('calls runtime.reload() exactly once after the server reports a new build', async () => {
    server = await startReloadServer();
    let reloads = 0;
    const sandbox = {
      fetch,
      setTimeout,
      encodeURIComponent,
      globalThis: undefined as unknown,
      chrome: { runtime: { reload: () => (reloads += 1) } },
    };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(devReloadScript(server.port), sandbox);

    await new Promise((r) => setTimeout(r, 200));
    expect(reloads).toBe(0);
    server.bump();
    await new Promise((r) => setTimeout(r, 200));
    expect(reloads).toBe(1);
    server.bump();
    await new Promise((r) => setTimeout(r, 200));
    expect(reloads).toBe(1);
  });
});
