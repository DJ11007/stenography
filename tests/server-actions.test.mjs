import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function sourceFiles(directory){return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const path=join(directory,entry.name);return entry.isDirectory()?sourceFiles(path):/\.(?:ts|tsx)$/.test(entry.name)?[path]:[]})}

test('"use server" modules export only async functions and erased types',()=>{
  for(const file of sourceFiles(fileURLToPath(new URL("../app",import.meta.url)))){const source=readFileSync(file,"utf8");if(!/^\s*["']use server["'];/m.test(source))continue;const runtimeExports=[...source.matchAll(/^export\s+(?!type\b|interface\b)(.+)$/gm)].map(match=>match[1]);for(const declaration of runtimeExports){assert.match(declaration,/^(?:default\s+)?async\s+function\b|^const\s+\w+\s*=\s*async\b/,`${file} has a non-async runtime export: ${declaration}`)}}
});
