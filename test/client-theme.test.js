import test from 'node:test'
import assert from 'node:assert/strict'
import { clientSource, loadClient, palettes, renderViews, tasks } from './helpers/client-theme.js'

// This is deliberately a small evaluator for the color expressions the bundle
// uses, not a CSS engine. Unknown syntax fails closed; browser validation covers
// actual computed styles and live theme switching separately.
function color(value, palette) {
  value = value.replace(/var\((--[\w-]+),\s*([^()]+)\)/g,
    (_, name, fallback) => palette[name] || fallback).trim()
  const mix = /^color-mix\(in srgb,\s*(.+?)\s+(\d+)%\s*,\s*(.+)\)$/.exec(value)
  if (mix) {
    const a = color(mix[1], palette), b = color(mix[3], palette), weight = Number(mix[2]) / 100
    return a.map((channel, i) => channel * weight + b[i] * (1 - weight))
  }
  if (value === 'transparent') return [0, 0, 0, 0]
  if (value.startsWith('#')) {
    let hex = value.slice(1)
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
    assert.match(hex, /^(?:[a-f\d]{6}|[a-f\d]{8})$/i)
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .concat(hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1)
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(value)
  assert.ok(rgb, 'Unsupported color: ' + value)
  const channels = rgb[1].split(',').map(Number)
  return channels.slice(0, 3).map((n) => n / 255).concat(channels[3] ?? 1)
}
function over(fg, bg) {
  return fg.slice(0, 3).map((n, i) => n * fg[3] + bg[i] * (1 - fg[3])).concat(1)
}
function luminance(rgb) {
  return rgb.slice(0, 3).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
    .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0)
}
function contrast(fg, bg) {
  const a = luminance(over(fg, bg)), b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
function textColors(node, palette, background, foreground, result = []) {
  if (node == null || typeof node === 'boolean') return result
  if (typeof node !== 'object') {
    result.push({ text: String(node), background, foreground })
    return result
  }
  if (node.type === 'style' || node.type === 'svg') return result
  const style = node.props.style || {}
  const bg = style.background && style.background !== 'none'
    ? over(color(style.background, palette), background) : background
  const fg = style.color ? color(style.color, palette) : foreground
  for (const child of node.children) textColors(child, palette, bg, fg, result)
  return result
}

const client = loadClient()
test('kanban uses real host surface aliases, never nonexistent layer zero', () => {
  assert.doesNotMatch(clientSource, /--dsw-alias-bg-layer-0/)
  for (const key of ['surface', 'selectBg', 'selectBgPop', 'chipBg', 'featBg', 'issueBg', 'refactorBg']) {
    const light = color(client.TB.color[key], palettes.light)
    const dark = color(client.TB.color[key], palettes.dark)
    assert.notDeepEqual(dark, light, key + ' must follow host theme')
    assert.ok(luminance(dark) < 0.15, key + ' must stay dark in dark mode')
  }
})

// No host tokens exercises standalone fallbacks. Literal strings from the
// rendered tree ensure titles, type/stage badges, step counts and stage numbers
// are checked on their actual ancestor backgrounds, including selected rows.
for (const [mode, palette] of Object.entries({ fallback: {}, light: palettes.light, dark: palettes.dark })) {
  for (const selected of tasks.map((task) => task.slug)) {
    for (const [view, tree] of Object.entries(renderViews(client, selected))) {
      test(`${mode} ${view} selected=${selected}: primary text and badges are readable`, () => {
        const base = color(palette['--dsw-alias-bg-base'] || '#ffffff', palette)
        const text = color(palette['--dsw-alias-label-primary'] || '#0f172a', palette)
        const entries = textColors(tree, palette, base, text).filter(({ text }) =>
          tasks.some((task) => text === task.title || text === task.stage) ||
          ['功能', '缺陷', '重构'].includes(text) ||
          /(?:Current|Completed|Pending) step$/.test(text) ||
          /^\d+(?:\/\d+ 步骤)?$/.test(text))
        assert.ok(entries.length >= 8, 'Expected titles, badges and stage/step numbers')
        for (const { text, foreground, background } of entries) {
          const ratio = contrast(foreground, background)
          assert.ok(ratio >= 4.5, `${text}: contrast ${ratio.toFixed(2)} < 4.5:1`)
        }
      })
    }
  }
}
