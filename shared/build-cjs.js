// shared/*.js（ESM）から CommonJS 版 shared/cjs/*.cjs を生成する。
// サーバー（CommonJS）と jest は require 条件で .cjs を読み、クライアント（Vite）は import 条件で .js を読む。
// 契約ファイルを変更したら `npm run build:shared` で再生成してコミットする（生成物もコミットする）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(dir, 'cjs');
fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'build-cjs.js');
for (const file of files) {
  const src = fs.readFileSync(path.join(dir, file), 'utf8');
  const names = [];
  let out = src
    // export const X = ... → const X = ...（名前を控える）
    .replace(/^export const (\w+)/gm, (_, name) => {
      names.push(name);
      return `const ${name}`;
    })
    // export {}; は不要
    .replace(/^export \{\};?\s*$/gm, '');
  out = `// 自動生成（shared/build-cjs.js）。直接編集せず ${file} を直して再生成する。\n'use strict';\n${out}\nmodule.exports = { ${names.join(', ')} };\n`;
  fs.writeFileSync(path.join(outDir, file.replace(/\.js$/, '.cjs')), out);
  console.log(`生成: shared/cjs/${file.replace(/\.js$/, '.cjs')} (${names.length} exports)`);
}
