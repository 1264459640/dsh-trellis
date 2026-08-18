#!/usr/bin/env node
/**
 * trellis-workflow — one-click installer for the injection layer.
 *
 * Wires a DSH profile so the plugin's injection layer actually loads:
 *
 *   1. dependency link  — ensures
 *      `<profile>/node_modules/@banana-peeljj12/dsh-trellis` is a junction to
 *      this package (idempotent; recreates nothing that already points here);
 *   2. config row       — ensures `cordis.patch.yml` contains the
 *      `- id: trellis-workflow` loader row with the requested config
 *      (idempotent; never overwrites an existing row);
 *   3. (optional)       — `--fix-deps` removes stale `link:` deps whose target
 *      path does not exist; `--uninstall` removes the config row, the
 *      dependency junction, and the package.json dep entries in one step.
 *   `--patch-harness`   — standalone: only patch the harness
 *      `WEB_SETTINGS_NAMESPACES` allowlist (no profile required), so the Web
 *      client can read/write the `trellis-workflow` settings namespace.
 *
 * After a successful run, restart the DSH process for the profile. The package
 * `postinstall` hook invokes this script with `--auto` (safe, idempotent, and
 * skippable via `TRELLIS_SKIP_AUTO=1`), so a normal install of this package
 * wires the injection layer with no extra step.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_ID = 'trellis-workflow'
const PLUGIN_NAME = '@banana-peeljj12/dsh-trellis'
const PKG_IN_NM = path.join('node_modules', PLUGIN_NAME)

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    allowlist: [],
    injectStep: null,
    skipKeywords: null,
    inline: null,
    profile: null,
    auto: false,
    uninstall: false,
    fixDeps: false,
    patchHarness: false,
    dryRun: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case '--profile':
        args.profile = argv[++i]
        break
      case '--allowlist':
        args.allowlist.push(argv[++i])
        break
      case '--inject-step':
        args.injectStep = Number(argv[++i])
        break
      case '--skip-keywords':
        args.skipKeywords = String(argv[++i])
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        break
      case '--inline':
        args.inline = true
        break
      case '--auto':
        args.auto = true
        break
      case '--uninstall':
        args.uninstall = true
        break
      case '--fix-deps':
        args.fixDeps = true
        break
      case '--patch-harness':
        args.patchHarness = true
        break
      case '--dry-run':
        args.dryRun = true
        break
      case '--help':
      case '-h':
        args.help = true
        break
      default:
        console.error(`未知参数: ${a}`)
        args.help = true
    }
  }
  return args
}

function printHelp() {
  console.log(`
trellis-workflow 注入层一键安装器

用法:
  node scripts/install.mjs [选项]

选项:
  --profile <name>      目标 profile（默认自动识别包含本插件的 profile）
  --allowlist <path>    注入白名单项目根，可重复
  --inject-step <n>     只在该步注入（默认 1）
  --skip-keywords a,b   出现这些词的本轮跳过注入
  --inline              按 codex-inline 调度模式解析阶段
  --auto                幂等自动模式（postinstall 使用；无法识别时静默退出）
  --dry-run             只预览将发生的改动，不写盘
  --uninstall           一步卸载：配置行 + 依赖 junction + package.json 依赖项 + harness 白名单回撤
  --fix-deps            清理 package.json 中指向不存在路径的 trellis link 依赖
  --patch-harness       只对 dsh-host-apiproxy 的 WEB_SETTINGS_NAMESPACES 白名单做幂等补丁
                       （新增 trellis-workflow，无需 profile；DSH 升级覆盖后可重跑补回）
  -h, --help            显示本帮助

安装时会额外对 dsh-host-apiproxy 的 WEB_SETTINGS_NAMESPACES 白名单做幂等补丁
（新增 trellis-workflow，Web 设置页签必需）；DSH 升级覆盖后可重跑本命令补回。

示例:
  node scripts/install.mjs --profile web --allowlist "F:/Projects/FordProject"
  node scripts/install.mjs --patch-harness
  node scripts/install.mjs --dry-run
  node scripts/install.mjs --uninstall --dry-run
  node scripts/install.mjs --uninstall
`)
}

// ---------------------------------------------------------------------------
// profile resolution
// ---------------------------------------------------------------------------

function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

/** This package is installed inside a profile's node_modules — derive the name. */
function profileFromPackagePath() {
  const norm = PACKAGE_ROOT.replace(/\\/g, '/')
  const escaped = PLUGIN_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`/profiles/([^/]+)/node_modules/${escaped}$`).exec(norm)
  return m ? m[1] : null
}

/** Scan DSH_HOME/profiles for the one that links this exact package. */
function findMatchingProfile(home) {
  const profilesDir = path.join(home, 'profiles')
  if (!fs.existsSync(profilesDir)) return null
  const real = fs.realpathSync(PACKAGE_ROOT)
  for (const name of fs.readdirSync(profilesDir)) {
    if (name === 'node_modules') continue
    const link = path.join(profilesDir, name, PKG_IN_NM)
    try {
      if (fs.realpathSync(link) === real) return name
    } catch {
      /* not a link to us — skip */
    }
  }
  return null
}

function listProfiles(home) {
  const profilesDir = path.join(home, 'profiles')
  if (!fs.existsSync(profilesDir)) return '（无 profiles 目录）'
  return fs
    .readdirSync(profilesDir)
    .filter((n) => n !== 'node_modules')
    .join(', ')
}

// ---------------------------------------------------------------------------
// harness settings-exposure allowlist patch (path A)
//
// The Web client may only read/write settings namespaces listed in
// `WEB_SETTINGS_NAMESPACES` (dsh-host-apiproxy). This idempotent patch adds
// `trellis-workflow` to that allowlist so the shipped settings tab works.
// DSH updates overwrite the harness copy; re-run install to re-apply.
// ---------------------------------------------------------------------------

/** Locate every installed dsh-host-apiproxy bundle (Windows + Linux/macOS). */
function harnessApiProxyFiles() {
  const paths = []
  const localAppData = process.env.LOCALAPPDATA
  if (localAppData) {
    const npxRoot = path.join(localAppData, 'npm-cache', '_npx')
    if (fs.existsSync(npxRoot)) {
      for (const dir of fs.readdirSync(npxRoot)) {
        paths.push(path.join(npxRoot, dir, 'node_modules', '@deepseek-ai', 'dsh-host-apiproxy', 'lib', 'index.js'))
      }
    }
    // Desktop-installed harnesses live under %LOCALAPPDATA%\Programs\<app>\resources\host
    // (e.g. the DeepSeek Harness desktop app) — the npx-cache scan above misses them.
    const programsRoot = path.join(localAppData, 'Programs')
    if (fs.existsSync(programsRoot)) {
      let apps = []
      try {
        apps = fs.readdirSync(programsRoot)
      } catch {
        /* unreadable Programs dir — skip */
      }
      for (const app of apps) {
        paths.push(path.join(programsRoot, app, 'resources', 'host', 'node_modules', '@deepseek-ai', 'dsh-host-apiproxy', 'lib', 'index.js'))
      }
    }
  }
  // Linux/macOS global installs: the running node's own prefix, every nvm
  // version, and the `~/.npm/_npx` cache (used by `npx dsh`).
  if (process.execPath) {
    const prefix = path.resolve(path.dirname(process.execPath), '..')
    paths.push(path.join(prefix, 'lib', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-host-apiproxy', 'lib', 'index.js'))
  }
  const nvmDir = path.join(os.homedir(), '.nvm', 'versions', 'node')
  if (fs.existsSync(nvmDir)) {
    for (const ver of fs.readdirSync(nvmDir)) {
      paths.push(path.join(nvmDir, ver, 'lib', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-host-apiproxy', 'lib', 'index.js'))
    }
  }
  const npxCache = path.join(os.homedir(), '.npm', '_npx')
  if (fs.existsSync(npxCache)) {
    for (const dir of fs.readdirSync(npxCache)) {
      paths.push(path.join(npxCache, dir, 'node_modules', '@deepseek-ai', 'dsh-host-apiproxy', 'lib', 'index.js'))
    }
  }
  const seen = new Set()
  return paths.filter((file) => {
    if (!fs.existsSync(file)) return false
    try {
      const real = fs.realpathSync(file)
      if (seen.has(real)) return false
      seen.add(real)
      return true
    } catch {
      return true
    }
  })
}

/** Add "trellis-workflow" to WEB_SETTINGS_NAMESPACES (idempotent). */
function patchHarnessAllowlist(dryRun) {
  const results = []
  const files = harnessApiProxyFiles()
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8')
    if (src.includes('"trellis-workflow"')) {
      results.push(`白名单已包含 trellis-workflow: ${file}`)
      continue
    }
    const m = /const WEB_SETTINGS_NAMESPACES\s*=\s*\[[\s\S]*?\];/.exec(src)
    if (!m) {
      results.push(`未找到 WEB_SETTINGS_NAMESPACES 块，跳过: ${file}`)
      continue
    }
    if (dryRun) {
      results.push(`[dry-run] 将补丁 WEB_SETTINGS_NAMESPACES: ${file}`)
      continue
    }
    const block = m[0]
    const insertAt = block.lastIndexOf(']')
    const patched =
      block.slice(0, insertAt).replace(/[ \t]*\r?\n[ \t]*$/, '') +
      ',\n\t"trellis-workflow"\n' +
      block.slice(insertAt)
    fs.writeFileSync(file, src.replace(block, patched))
    results.push(`已补丁白名单（新增 trellis-workflow）: ${file}`)
  }
  if (!files.length) {
    results.push('未找到 dsh-host-apiproxy（检查 LOCALAPPDATA/npm-cache/_npx）；请手动把 trellis-workflow 加入 WEB_SETTINGS_NAMESPACES')
  }
  return results
}

/** Remove "trellis-workflow" from WEB_SETTINGS_NAMESPACES (idempotent). */
function unpatchHarnessAllowlist(dryRun) {
  const results = []
  const files = harnessApiProxyFiles()
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8')
    if (!src.includes('"trellis-workflow"')) {
      results.push(`白名单无 trellis-workflow 条目: ${file}`)
      continue
    }
    if (dryRun) {
      results.push(`[dry-run] 将移除白名单条目: ${file}`)
      continue
    }
    const out = src
      .replace(/,\r?\n\t"trellis-workflow"\r?\n/, '\n')
      .replace(/\t"trellis-workflow",\r?\n/, '')
      .replace(/\t"trellis-workflow"\r?\n/, '')
    fs.writeFileSync(file, out)
    results.push(`已移除白名单条目: ${file}`)
  }
  if (!files.length) {
    results.push('未找到 dsh-host-apiproxy，跳过白名单回撤')
  }
  return results
}

// ---------------------------------------------------------------------------
// step 1 — dependency junction
// ---------------------------------------------------------------------------

function ensureLink(profileDir, dryRun) {
  const linkPath = path.join(profileDir, PKG_IN_NM)
  const real = fs.realpathSync(PACKAGE_ROOT)
  if (fs.existsSync(linkPath)) {
    try {
      if (fs.realpathSync(linkPath) === real) {
        return { ok: true, message: `依赖链接已就绪: ${linkPath}` }
      }
    } catch {
      /* broken link — fall through to recreate */
    }
    let current = '（无法解析）'
    try {
      current = fs.realpathSync(linkPath)
    } catch {
      /* broken */
    }
    return { ok: false, message: `依赖链接指向其他位置（${current}），未改动；如需修复请先删除: ${linkPath}` }
  }
  if (dryRun) return { ok: true, message: `[dry-run] 将创建 junction: ${linkPath} -> ${PACKAGE_ROOT}` }
  fs.mkdirSync(path.dirname(linkPath), { recursive: true })
  try {
    fs.symlinkSync(PACKAGE_ROOT, linkPath, 'junction')
  } catch (e) {
    return { ok: false, message: `创建 junction 失败: ${e.message}` }
  }
  return { ok: true, message: `已创建 junction: ${linkPath} -> ${PACKAGE_ROOT}` }
}

// ---------------------------------------------------------------------------
// step 2 — cordis.patch.yml row
// ---------------------------------------------------------------------------

function buildRow(args) {
  const config = {}
  if (args.allowlist.length) config.allowlist = args.allowlist
  if (args.injectStep !== null) config.injectStep = args.injectStep
  if (args.skipKeywords !== null) config.skipKeywords = args.skipKeywords
  if (args.inline !== null) config.inline = args.inline
  const lines = ['- id: trellis-workflow', `  name: '${PLUGIN_NAME}'`]
  if (Object.keys(config).length) {
    lines.push('  config:')
    for (const [k, v] of Object.entries(config)) {
      if (Array.isArray(v)) {
        if (v.length) {
          lines.push(`    ${k}:`)
          for (const item of v) lines.push(`      - "${item}"`)
        }
      } else if (typeof v === 'boolean' || typeof v === 'number') {
        lines.push(`    ${k}: ${v}`)
      } else {
        lines.push(`    ${k}: "${String(v)}"`)
      }
    }
  }
  return lines.join('\n') + '\n'
}

function hasRow(text) {
  return /^\s*- id:\s*trellis-workflow\s*$/m.test(text)
}

function insertRow(text, row) {
  const trimmed = text.trim()
  if (trimmed === '' || trimmed.endsWith('[]')) {
    // empty file, or the default patch header with the empty [] marker:
    // keep the header comments, drop the [] markers, append the row.
    const idx = text.lastIndexOf('[]')
    if (idx === -1) return row
    return text.slice(0, idx) + row
  }
  if (!text.includes('[') && /(^|\n)\s*- /.test(text)) {
    // plain block list — append the row at the end
    return text.replace(/\s*$/, '\n') + row
  }
  const idx = text.lastIndexOf(']')
  if (idx !== -1 && text.slice(0, idx).includes('[')) {
    const before = text.slice(0, idx).replace(/\s+$/, '')
    const sep = before.endsWith('[') ? '' : '\n'
    return before + sep + row + text.slice(idx)
  }
  throw new Error(`无法识别的 cordis.patch.yml 结构，请手动添加：\n${row}`)
}

function removeRow(text) {
  const lines = text.split('\n')
  const kept = []
  let skipping = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!skipping && hasRow(line)) {
      skipping = true
      continue
    }
    if (skipping) {
      const next = lines[i + 1]
      const blank = line.trim() === ''
      const topLevel = /^\S/.test(line)
      if (!blank && !topLevel) continue // indented — still inside the block
      if (blank && next !== undefined && /^\s+\S/.test(next)) continue // blank between block lines
      skipping = false
    }
    kept.push(line)
  }
  let out = kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
  if (!/^\s*- id:/m.test(out)) {
    const header = out
      .split('\n')
      .filter((l) => l.startsWith('#'))
      .join('\n')
    out = (header ? header + '\n\n' : '') + '[]\n'
  }
  return out
}

function patchPatchFile(patchPath, row, dryRun) {
  const raw = fs.readFileSync(patchPath, 'utf8')
  if (hasRow(raw)) return { changed: false, message: `插件行已存在，未改动: ${patchPath}` }
  let out
  if (/\[\s*-\s*id:\s*trellis-workflow/.test(raw)) {
    // repair a broken inline write (`[- id: ...` from an older buggy version):
    // keep the header comments, drop the mangled construct, append the row.
    const header = raw.split(/\[\s*-\s*id:\s*trellis-workflow/)[0].replace(/\s+$/, '')
    out = (header ? header + '\n\n' : '') + row
  } else {
    out = insertRow(raw, row)
  }
  if (dryRun) return { changed: true, message: `[dry-run] 将写入插件行到: ${patchPath}` }
  fs.writeFileSync(patchPath, out)
  return { changed: true, message: `已写入插件行: ${patchPath}` }
}

function uninstallRow(patchPath, dryRun) {
  const raw = fs.readFileSync(patchPath, 'utf8')
  if (!hasRow(raw)) return { changed: false, message: '未找到插件行，无需移除' }
  const out = removeRow(raw)
  if (dryRun) return { changed: true, message: `[dry-run] 将移除插件行: ${patchPath}` }
  fs.writeFileSync(patchPath, out)
  return { changed: true, message: `已移除插件行: ${patchPath}` }
}

// ---------------------------------------------------------------------------
// optional — stale link deps
// ---------------------------------------------------------------------------

function fixDeps(profileDir, dryRun) {
  const pkgPath = path.join(profileDir, 'package.json')
  if (!fs.existsSync(pkgPath)) return []
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const deps = pkg.dependencies || {}
  const bad = []
  for (const [key, spec] of Object.entries(deps)) {
    const m = /^link:(.+)$/.exec(String(spec))
    if (!m) continue
    const target = m[1].replace(/[\\/]+$/, '')
    if (fs.existsSync(target)) continue
    bad.push({ key, spec })
    if ((key === 'trellis-dsh' || key === '@trellis-dsh/trellis-workflow' || key === PLUGIN_NAME) && !dryRun) delete deps[key]
  }
  if (bad.length && !dryRun) {
    pkg.dependencies = deps
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  }
  return bad
}

// ---------------------------------------------------------------------------
// uninstall helpers
// ---------------------------------------------------------------------------

/**
 * Remove the node_modules junction — only when it is a link that resolves to
 * this package. A real directory or a link elsewhere is left untouched.
 */
function removeLink(profileDir, dryRun) {
  const linkPath = path.join(profileDir, PKG_IN_NM)
  if (!fs.existsSync(linkPath)) return { ok: true, message: `依赖链接不存在，跳过: ${linkPath}` }
  let target
  try {
    target = path.resolve(fs.readlinkSync(linkPath))
  } catch {
    return { ok: false, message: `${linkPath} 不是链接（可能是真实目录），未删除，请手动处理` }
  }
  if (target.toLowerCase() !== PACKAGE_ROOT.toLowerCase()) {
    return { ok: false, message: `依赖链接指向其他位置（${target}），未删除` }
  }
  if (dryRun) return { ok: true, message: `[dry-run] 将删除依赖链接: ${linkPath}` }
  fs.rmSync(linkPath, { force: true })
  return { ok: true, message: `已删除依赖链接: ${linkPath}` }
}

/** Remove this plugin's dependency entries from the profile package.json. */
function removeTrellisDeps(profileDir, dryRun) {
  const pkgPath = path.join(profileDir, 'package.json')
  if (!fs.existsSync(pkgPath)) return []
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const deps = pkg.dependencies || {}
  const removed = []
  for (const key of ['trellis-dsh', '@trellis-dsh/trellis-workflow', PLUGIN_NAME]) {
    if (key in deps) {
      removed.push(`${key}: ${deps[key]}`)
      delete deps[key]
    }
  }
  if (removed.length && !dryRun) {
    pkg.dependencies = deps
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  }
  return removed.map((r) => (dryRun ? `[dry-run] 将移除依赖项: ${r}` : `已移除依赖项: ${r}`))
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2))
if (args.help) {
  printHelp()
  process.exit(0)
}
if (process.env.TRELLIS_SKIP_AUTO === '1' && args.auto) {
  console.log('TRELLIS_SKIP_AUTO=1，跳过自动安装')
  process.exit(0)
}
if (args.patchHarness) {
  // Standalone harness allowlist patch — no profile required.
  console.log('== trellis-workflow harness 白名单补丁 ==')
  for (const message of patchHarnessAllowlist(args.dryRun)) console.log(message)
  console.log('\n补丁完成。重启 DSH（对应 profile 的进程）后，Web 设置页签生效。')
  process.exit(0)
}

const home = dshHome()
let profileName = args.profile
if (!profileName) profileName = profileFromPackagePath()
if (!profileName && !args.auto) profileName = findMatchingProfile(home)
if (!profileName) {
  if (args.auto) {
    console.log('未识别到目标 profile（--auto），跳过')
    process.exit(0)
  }
  console.error(`无法确定目标 profile；用 --profile <name> 指定。可用: ${listProfiles(home)}`)
  process.exit(1)
}
const profileDir = path.join(home, 'profiles', profileName)
if (!fs.existsSync(profileDir)) {
  if (args.auto) {
    console.log(`profile 不存在: ${profileDir}（--auto），跳过`)
    process.exit(0)
  }
  console.error(`profile 不存在: ${profileDir}`)
  process.exit(1)
}

console.log('== trellis-workflow 注入层安装器 ==')
console.log(`包目录:   ${PACKAGE_ROOT}`)
console.log(`DSH_HOME: ${home}`)
console.log(`profile:  ${profileName} (${profileDir})`)

if (args.uninstall) {
  // 1. config row
  const patchPath = path.join(profileDir, 'cordis.patch.yml')
  if (fs.existsSync(patchPath)) {
    console.log(uninstallRow(patchPath, args.dryRun).message)
  } else {
    console.log(`cordis.patch.yml 不存在: ${patchPath}`)
  }
  // 2. dependency junction (only when it points at this package)
  console.log(removeLink(profileDir, args.dryRun).message)
  // 3. package.json dep entries
  for (const message of removeTrellisDeps(profileDir, args.dryRun)) console.log(message)
  // 4. harness settings-exposure allowlist (path A reversal)
  for (const message of unpatchHarnessAllowlist(args.dryRun)) console.log(message)
  console.log('\n卸载完成。重启 DSH（对应 profile 的进程）后，插件完全移除。')
  process.exit(0)
}

let ok = true
const link = ensureLink(profileDir, args.dryRun)
console.log(link.message)
if (!link.ok) ok = false

const patchPath = path.join(profileDir, 'cordis.patch.yml')
if (fs.existsSync(patchPath)) {
  try {
    console.log(patchPatchFile(patchPath, buildRow(args), args.dryRun).message)
  } catch (e) {
    console.error(e.message)
    ok = false
  }
} else {
  console.error(`cordis.patch.yml 不存在: ${patchPath}`)
  ok = false
}

if (!args.allowlist.length && !args.auto) {
  console.log('提示：未指定 --allowlist，注入将使用插件默认 allowlist；建议用 --allowlist "<项目根>" 限定注入范围')
}

if (args.fixDeps) {
  const bad = fixDeps(profileDir, args.dryRun)
  for (const b of bad) {
    console.log((args.dryRun ? '[dry-run] 失效 link 依赖: ' : '已移除失效 link 依赖: ') + `${b.key}: ${b.spec}`)
  }
  if (!bad.length) console.log('依赖检查：无失效 link 依赖')
}

// harness settings-exposure allowlist (path A): the Web settings tab needs it
for (const message of patchHarnessAllowlist(args.dryRun)) console.log(message)

if (ok) {
  console.log('\n完成。重启 DSH（对应 profile 的进程）后，注入层与 Web 设置页签生效。')
}
process.exit(ok ? 0 : 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main()
}

// exported for regression testing (importing this module must not run main())
export { buildRow, hasRow, insertRow, patchPatchFile, patchHarnessAllowlist, removeLink, removeRow, removeTrellisDeps, unpatchHarnessAllowlist, uninstallRow }
