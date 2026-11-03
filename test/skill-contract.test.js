import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(path.join(repoRoot, rel), 'utf8')

test('bootstrap contract covers migration, initialization, root metadata and files whitelist', () => {
  const text = read('skills/trellis-spec-bootstrap/SKILL.md')
  assert.match(text, /迁移分支/)
  assert.match(text, /初始化分支/)
  assert.match(text, /\.trellis\/doc\.json/)
  assert.match(text, /files.*运行时注入白名单/)
  assert.match(text, /root.*Skill 元数据/)
  assert.match(text, /root.*不拼接.*files/s)
  assert.match(text, /不修改业务文档正文/)
})

test('development and verification consumers read the configured files whitelist', () => {
  for (const rel of ['skills/trellis-before-dev/SKILL.md', 'skills/trellis-check/SKILL.md']) {
    const text = read(rel)
    assert.match(text, /\.trellis\/doc\.json/, rel)
    assert.match(text, /files/, rel)
    assert.match(text, /无配置/, rel)
  }
})

test('update-spec routes to configured docs and requires files maintenance for new injected docs', () => {
  const text = read('skills/trellis-update-spec/SKILL.md')
  assert.match(text, /优先更新已有权威文档/)
  assert.match(text, /新增需要注入的文档必须同步 files/)
  assert.match(text, /归属不明就问/)
  assert.match(text, /不静默写回旧目录/)
})

test('workflow skills and templates no longer present the legacy directory as the only quality gate', () => {
  const files = [
    'skills/trellis-feat/SKILL.md',
    'skills/trellis-refactor/SKILL.md',
    'skills/_templates/feat/design.md',
    'skills/_templates/feat/review.md',
    'skills/_templates/issue/fix-note.md',
    'skills/_templates/refactor/apply-notes.md',
    'skills/_templates/refactor/refactor-design.md',
    'skills/_templates/work-types.md',
  ]
  for (const rel of files) {
    const text = read(rel)
    assert.doesNotMatch(text, /按项目 `\.trellis\/spec\/` 质量门/, rel)
    assert.doesNotMatch(text, /写入 `\.trellis\/spec\/`（含 `decisions\/`）/, rel)
    assert.doesNotMatch(text, /严格遵循 `\.trellis\/spec\/` 声明的/, rel)
  }
})
test('skill path templates use $root instead of a hardcoded spec package root', () => {
  const files = [
    'skills/trellis-spec-bootstrap/SKILL.md',
    'skills/trellis-update-spec/SKILL.md',
    'skills/trellis-before-dev/SKILL.md',
    'skills/trellis-check/SKILL.md',
  ]
  for (const rel of files) {
    const text = read(rel)
    assert.doesNotMatch(text, /\.trellis\/spec\/<package>\/<layer>\//, rel)
    assert.match(text, /\$root\/<package>\/<layer>\//, rel)
  }
})
test('consumer skills do not retain a second hardcoded spec root', () => {
  const files = [
    'skills/trellis-update-spec/SKILL.md',
    'skills/trellis-before-dev/SKILL.md',
    'skills/trellis-check/SKILL.md',
    'skills/trellis-feat/SKILL.md',
    'skills/trellis-refactor/SKILL.md',
    'skills/_templates/work-types.md',
    'skills/_templates/feat/review.md',
  ]
  for (const rel of files) {
    assert.doesNotMatch(read(rel), /\.trellis\/spec\//, rel)
  }
})
test('spec skills carry a complete and valid doc.json context', () => {
  for (const rel of [
    'skills/trellis-spec-bootstrap/SKILL.md',
    'skills/trellis-before-dev/SKILL.md',
    'skills/trellis-check/SKILL.md',
    'skills/trellis-update-spec/SKILL.md',
  ]) {
    const text = read(rel)
    assert.match(text, /\.trellis\/doc\.json/, rel)
    assert.match(text, /root/, rel)
    assert.match(text, /files/, rel)
    assert.match(text, /完整.*路径/, rel)
  }

  const before = read('skills/trellis-before-dev/SKILL.md')
  assert.match(before, /读取顺序/)
  const update = read('skills/trellis-update-spec/SKILL.md')
  assert.match(update, /读取与写入顺序/)
  assert.match(update, /docs\/guides\/index\.md/)

  const bootstrap = read('skills/trellis-spec-bootstrap/SKILL.md')
  assert.doesNotMatch(bootstrap, /"files"\s*:\s*\[\s*"\$root\//)
  assert.ok(!bootstrap.includes('$root/`n'), 'directory tree must not contain a literal `n')
})
