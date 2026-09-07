#!/usr/bin/env node
/**
 * Extract a single version entry from CHANGELOG.md (by tag) and print it to
 * stdout. Used by .github/workflows/release.yml to build the GitHub Release
 * body from the changelog. Exits non-zero when the tag has no entry.
 *
 * Usage: node scripts/extract-changelog.mjs <tag> [changelogPath]
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const tag = process.argv[2]
const changelogPath = resolve(process.argv[3] ?? 'CHANGELOG.md')

if (!tag) {
  console.error('usage: node scripts/extract-changelog.mjs <tag> [changelogPath]')
  process.exit(2)
}

const lines = readFileSync(changelogPath, 'utf8').split('\n')
const start = lines.findIndex((line) => line.startsWith(`## ${tag}`))
if (start === -1) {
  console.error(`no changelog entry for tag "${tag}" in ${changelogPath}`)
  process.exit(1)
}

// Collect until the next top-level version heading (`## v...`); section
// headings inside the entry (## 功能 / ## Features / ...) are kept.
const body = []
for (let i = start + 1; i < lines.length; i++) {
  if (/^## v/.test(lines[i])) break
  body.push(lines[i])
}

// Trim leading/trailing blank lines only (the entry may legitimately contain
// `---` separators and blank lines between bilingual halves).
let trimmed = body.join('\n')
trimmed = trimmed.replace(/^\s*\n/, '').replace(/\n\s*$/, '')
if (trimmed.length === 0) {
  console.error(`changelog entry for tag "${tag}" is empty`)
  process.exit(1)
}

process.stdout.write(trimmed)
