import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("F1a package defines Next.js foundation stack", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies.next, "15.3.0");
  assert.equal(pkg.dependencies.react, "19.0.0");
  assert.ok(pkg.scripts.storybook);
});

test("F1a app shell and storybook files exist", () => {
  for (const rel of [
    "app/layout.tsx",
    "app/page.tsx",
    "app/error.tsx",
    "app/loading.tsx",
    ".storybook/main.ts",
    "stories/button.stories.tsx",
  ]) {
    assert.ok(fs.existsSync(path.join(root, rel)), `${rel} missing`);
  }
});

test("F1a global CSS defines design tokens", () => {
  const css = read("app/globals.css");
  assert.match(css, /--accent:/);
  assert.match(css, /color-scheme: dark/);
});
