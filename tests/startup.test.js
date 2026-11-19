const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const express = require('express');
const { startServer, listenHttp, readPort, startupErrorMessage } = require('../server');
const { diagnoseDatabaseError, safeDatabaseError } = require('../src/utils/database-errors');
const { connectDatabaseOrThrow } = require('../src/database');
const { loadEnv } = require('../src/config');
const execute = promisify(execFile);

test('Successful HTTP bind has a real address and serves requests', async t => {
  const server = await listenHttp((req, res) => res.end('ready'), 0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  assert.ok(server.address().port > 0);
  assert.equal(await (await fetch(`http://127.0.0.1:${server.address().port}`)).text(), 'ready');
});

test('Express failure callback receives EADDRINUSE while address is null; corrected listener rejects safely', async t => {
  const owner = await listenHttp((req, res) => res.end('original server'), 0);
  t.after(() => new Promise(resolve => owner.close(resolve)));
  const port = owner.address().port;
  await new Promise((resolve, reject) => {
    const duplicate = express().listen(port, error => {
      try {
        assert.equal(error.code, 'EADDRINUSE');
        assert.equal(duplicate.address(), null);
        resolve();
      } catch (failure) { reject(failure); }
    });
  });
  await assert.rejects(listenHttp(express(), port), { code: 'EADDRINUSE' });
  assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'original server');
  assert.match(startupErrorMessage({ code: 'EADDRINUSE' }, port), /already in use/);
});

test('CLI port conflict exits 1 with a useful message before attempting MongoDB', async t => {
  const owner = await listenHttp((req, res) => res.end('owner'), 0);
  t.after(() => new Promise(resolve => owner.close(resolve)));
  try {
    await execute(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(owner.address().port), MONGODB_URI: 'mongodb://127.0.0.1:1/startup_test' },
      timeout: 10000,
    });
    assert.fail('A duplicate CLI launch must fail.');
  } catch (error) {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /EADDRINUSE/);
    assert.doesNotMatch(error.stderr, /TypeError|reading 'port'|MongoDB connection/);
    assert.equal(error.stdout, '');
  }
});

test('Port validation and other bind errors are actionable without raw errors', () => {
  assert.equal(readPort('3000'), 3000);
  assert.equal(readPort('0'), 0);
  for (const value of ['', '-1', '65536', 'abc', '3000pipe', '3.5']) assert.throws(() => readPort(value), { code: 'INVALID_PORT' });
  assert.match(startupErrorMessage({ code: 'EACCES' }, 3000), /Permission denied/);
  assert.match(startupErrorMessage({ code: 'EADDRNOTAVAIL' }, 3000), /unavailable/);
  assert.match(startupErrorMessage({ code: 'INVALID_PORT' }, 3000), /Invalid PORT/);
});

test('Started server shuts down gracefully and removes signal handlers and retry timers', async t => {
  const previousPort = process.env.PORT;
  const previousUri = process.env.MONGODB_URI;
  const sigint = process.listenerCount('SIGINT');
  const sigterm = process.listenerCount('SIGTERM');
  process.env.PORT = '0';
  process.env.MONGODB_URI = '';
  t.after(() => {
    if (previousPort === undefined) delete process.env.PORT; else process.env.PORT = previousPort;
    if (previousUri === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = previousUri;
  });
  const server = await startServer();
  assert.ok(server.address().port > 0);
  await server.shutdown();
  assert.equal(server.address(), null);
  assert.equal(process.listenerCount('SIGINT'), sigint);
  assert.equal(process.listenerCount('SIGTERM'), sigterm);
});

test('Environment loading resolves project .env independently of cwd and preserves process overrides', async t => {
  const source = path.join(__dirname, '../.env');
  const before = await fs.readFile(source).catch(() => null);
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'gourmet-env-test-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const key = 'GOURMET_STARTUP_ENV_TEST';
  const original = process.env[key];
  t.after(() => { if (original === undefined) delete process.env[key]; else process.env[key] = original; });
  const input = path.join(temp, 'sample.env');
  await fs.writeFile(input, `${key}=from-file\n`, 'utf8');
  delete process.env[key]; loadEnv(input); assert.equal(process.env[key], 'from-file');
  process.env[key] = 'from-process'; loadEnv(input); assert.equal(process.env[key], 'from-process');
  const result = await execute(process.execPath, ['-e', `process.chdir(require('node:os').tmpdir());require(${JSON.stringify(path.join(__dirname, '../src/config.js'))}).loadEnv();console.log(Boolean(process.env.MONGODB_URI));`], { env: { ...process.env, MONGODB_URI: '' } });
  // An explicit process value (including empty) retains precedence.
  assert.equal(result.stdout.trim(), 'false');
  const environment = { ...process.env }; delete environment.MONGODB_URI;
  const fromProject = await execute(process.execPath, ['-e', `process.chdir(require('node:os').tmpdir());require(${JSON.stringify(path.join(__dirname, '../src/config.js'))}).loadEnv();console.log(Boolean(process.env.MONGODB_URI));`], { env: environment });
  if (before) assert.equal(fromProject.stdout.trim(), 'true');
  if (before) assert.deepEqual(await fs.readFile(source), before);
});

test('Nested Atlas errors distinguish authentication, DNS, TLS, network and timeouts without revealing secrets', () => {
  const secret = 'mongodb+srv://private-user:private-password@private-host/private-db';
  const cases = [
    [{ code: 18, message: `Authentication failed ${secret}` }, 'AUTHENTICATION'],
    [{ code: 13, message: `not authorized ${secret}` }, 'AUTHORIZATION'],
    [{ cause: { code: 'ENOTFOUND', message: secret } }, 'DNS'],
    [{ reason: { servers: new Map([['private-host', { error: { code: 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR', message: `SSL routines: tlsv1 alert internal error ${secret}` } }]]) } }, 'TLS_HANDSHAKE'],
    [{ message: `certificate has expired ${secret}` }, 'TLS_CERTIFICATE'],
    [{ cause: { code: 'ECONNRESET', message: secret } }, 'NETWORK_RESET'],
    [{ cause: { code: 'ECONNREFUSED', message: secret } }, 'NETWORK_ACCESS'],
    [{ name: 'MongoServerSelectionError', message: `Server selection timed out ${secret}` }, 'TIMEOUT'],
    [{ name: 'MongoParseError', message: secret }, 'CONFIGURATION'],
  ];
  for (const [error, expected] of cases) {
    assert.equal(diagnoseDatabaseError(error).category, expected);
    const safe = safeDatabaseError(error);
    assert.doesNotMatch(safe.stack + JSON.stringify(safe), /private-user|private-password|private-host|mongodb\+srv/);
    assert.equal(safe.cause, undefined);
  }
});

test('Transient connection failures retry and require ping; authentication errors never retry', async () => {
  let calls = 0, pings = 0, disconnects = 0;
  const client = {
    async connect() { if (++calls < 2) { const e = new Error('TLS peer alert'); e.code = 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR'; throw e; } },
    async disconnect() { disconnects++; },
    connection: { db: { async command(body) { assert.deepEqual(body, { ping: 1 }); pings++; } } },
  };
  await connectDatabaseOrThrow('test-only-uri', { client, retryDelayMs: 0 });
  assert.equal(calls, 2); assert.equal(pings, 1); assert.equal(disconnects, 1);
  calls = 0;
  client.connect = async () => { calls++; const error = new Error('Authentication failed'); error.code = 18; throw error; };
  await assert.rejects(connectDatabaseOrThrow('test-only-uri', { client, retryDelayMs: 0 }), /AUTHENTICATION/);
  assert.equal(calls, 1);
  await assert.rejects(connectDatabaseOrThrow(''), /CONFIGURATION/);
});

test('Connection retry budget is finite and persistent failures return only sanitized errors', async () => {
  let calls = 0;
  const client = {
    async connect() { calls++; const error = new Error('socket reset mongodb://private-user:private-password@private-host'); error.code = 'ECONNRESET'; throw error; },
    async disconnect() {},
  };
  await assert.rejects(connectDatabaseOrThrow('test-only-uri', { client, attempts: 3, retryDelayMs: 0 }), error => error.name === 'DatabaseConnectionError' && !error.message.includes('private-password'));
  assert.equal(calls, 3);
});
