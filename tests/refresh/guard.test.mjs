import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { offenders } from '../../scripts/refresh-guard.mjs';

const bad = (...lines) => offenders(lines.join('\n'));

test('records and the New feed are allowed, bare paths or name-status', () => {
  assert.deepEqual(bad('src/content/answers/a.yaml', 'src/data/new.json'), []);
  assert.deepEqual(bad('M\tsrc/content/answers/a.yaml', 'A\tsrc/content/answers/sub/b.yaml', 'D\tsrc/content/answers/c.yaml'), []);
});

test('an empty diff is an allowed no-op', () => {
  assert.deepEqual(offenders(''), []);
  assert.deepEqual(offenders('\n'), []);
});

for (const [name, path] of [
  ['a script', 'scripts/check-leak.mjs'],
  ['the workflow', '.github/workflows/refresh.yml'],
  ['package.json', 'package.json'],
  ['the lockfile', 'package-lock.json'],
  ['docs', 'docs/refresh.md'],
  ['the content schema', 'src/content.config.ts'],
  ['another data file', 'src/data/topics.ts'],
]) {
  test(`${name} is refused`, () => assert.deepEqual(bad('M\t' + path), [path]));
}

test('a mixed set lists every offender and none of the allowed paths', () => {
  assert.deepEqual(
    bad('M\tsrc/content/answers/a.yaml', 'M\tpackage.json', 'M\tsrc/data/new.json', 'A\tdocs/x.md', 'M\tpackage.json'),
    ['package.json', 'docs/x.md'],
  );
});

test('a rename or copy counts both sides', () => {
  assert.deepEqual(bad('R100\tsrc/content/answers/a.yaml\tscripts/a.mjs'), ['scripts/a.mjs']);
  assert.deepEqual(bad('R090\tscripts/a.mjs\tsrc/content/answers/a.yaml'), ['scripts/a.mjs']);
  assert.deepEqual(bad('C75\tpackage.json\tsrc/content/answers/p.yaml'), ['package.json']);
  assert.deepEqual(bad('R100\tsrc/content/answers/a.yaml\tsrc/content/answers/b.yaml'), []);
});

test('deleting a file outside the area is refused', () => {
  assert.deepEqual(bad('D\tscripts/refresh-guard.mjs'), ['scripts/refresh-guard.mjs']);
});

test('path tricks are refused', () => {
  for (const p of [
    'src/content/answers/../../../package.json',
    'src/content/answers/..',
    'src/content/answers/./a.yaml',
    'src/content/answers//a.yaml',
    'src/content/answers/',
    'src/content/answers',
    '/src/content/answers/a.yaml',
    './src/content/answers/a.yaml',
    'src/content/answers\\a.yaml',
    'src\\content\\answers\\a.yaml',
    'SRC/content/answers/a.yaml',
    'src/Content/Answers/a.yaml',
    'SRC/DATA/new.json',
    'src/data/NEW.json',
    'src/data/new.json/extra',
    'src/data/new.json.bak',
    'src/content/answers-extra/a.yaml',
    'src/content/answers/a -> /etc/passwd',
    'src/content/answers/a\u0000.yaml',
    '"src/content/answers/odd\\tname.yaml"',
    ' src/data/new.json',
  ]) {
    assert.deepEqual(bad('M\t' + p), [p], p);
    assert.deepEqual(bad(p), [p], p);
  }
});

test('an unreadable status line is refused', () => {
  assert.deepEqual(bad('Z\tsrc/data/new.json'), ['Z\tsrc/data/new.json']);
});

test('the command exits 1 and names each offender, 0 when clean', () => {
  const run = (input) => spawnSync('node', ['scripts/refresh-guard.mjs'], { input, encoding: 'utf8' });
  const ok = run('M\tsrc/data/new.json\n');
  assert.equal(ok.status, 0);
  const no = run('M\tsrc/data/new.json\nM\tpackage.json\nA\tdocs/x.md\n');
  assert.equal(no.status, 1);
  assert.match(no.stderr, /package\.json/);
  assert.match(no.stderr, /docs\/x\.md/);
  assert.equal(run('').status, 0);
  assert.equal(spawnSync('node', ['scripts/refresh-guard.mjs', 'package.json'], { encoding: 'utf8' }).status, 1);
});
