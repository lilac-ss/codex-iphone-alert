import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
const result = spawnSync('/usr/bin/swiftc', ['-O', '-module-cache-path', '/tmp/codex-iphone-alert-swift-cache',
  new URL('../native/mac-state.swift', import.meta.url).pathname, '-o',
  new URL('../build/mac-state', import.meta.url).pathname], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
