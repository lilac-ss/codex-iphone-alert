import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
const result = spawnSync('/usr/bin/swiftc', ['-O', '-module-cache-path', '/tmp/codex-iphone-alert-swift-cache',
  fileURLToPath(new URL('../native/mac-state.swift', import.meta.url)), '-o',
  fileURLToPath(new URL('../build/mac-state', import.meta.url))], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
