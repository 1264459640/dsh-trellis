// Opt-in real-browser regression; does not start or modify the user's GUI.
// DSH_BROWSER_TEST_TOOLS points at a package.json beside playwright, esbuild,
// react and react-dom. DSH_BROWSER_EXECUTABLE optionally selects Chromium.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const tools = createRequire(path.resolve(process.env.DSH_BROWSER_TEST_TOOLS || 'package.json'))
const { chromium } = tools('playwright')
const { build } = tools('esbuild')
const root = fileURLToPath(new URL('../', import.meta.url))
const source = readFileSync(path.join(root, 'lib/client.js'), 'utf8')
const palettes = JSON.parse(readFileSync(path.join(root, 'test/fixtures/theme-palettes.json'), 'utf8'))
const marker = 'exports.apply = apply;'
assert.ok(source.includes(marker))
const instrumented = source.replace(marker,
  'window.modalTest = { TaskChip, HeroTaskChip, zh };\n' + marker)
const bundle = await build({
  stdin: {
    contents: `import * as react from ${JSON.stringify(tools.resolve('react'))};
      import * as dom from ${JSON.stringify(tools.resolve('react-dom'))};
      import {createRoot} from ${JSON.stringify(tools.resolve('react-dom/client'))};
      window.vendor = {react, dom, createRoot};`,
    resolveDir: root,
  },
  bundle: true, write: false, format: 'iife', platform: 'browser',
  define: { 'process.env.NODE_ENV': '"development"' },
})
const browser = await chromium.launch({
  executablePath: process.env.DSH_BROWSER_EXECUTABLE || undefined,
  headless: true,
})
try {
  const page = await browser.newPage({ viewport: { width: 1733, height: 827 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  // Only the problematic, observed Claude header rule is reproduced here.
  // The GUI itself is authenticated; this fixture makes no live API requests.
  await page.setContent(`<style>
    body { margin: 0; font: 14px sans-serif; }
    [data-dsh-header-actions] { position: fixed; top: 20px; right: 24px;
      transform: translateY(-50%); z-index: 50; }
    #hero { position: absolute; right: 120px; bottom: 160px; }
  </style><div id="header" data-dsh-header-actions></div><div id="hero"></div>`)
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await page.evaluate(() => {
    window.__ModuleLoader__ = { load({ factory }) {
      factory((id) => {
        if (id === 'react') return window.vendor.react
        if (id === 'react-dom') return window.vendor.dom
        if (id === '@deepseek-ai/dsh-client-ui-primitives') return {}
        throw new Error('Unexpected module: ' + id)
      })
    } }
    window.fetch = async (url) => ({ ok: true, json: async () => ({ ok: true, value:
      url.endsWith('/task-state') ? { kind: 'no-task' } : {
        kind: 'board', currentTask: 'issue-10-22-demo', tasks: [{
          slug: 'issue-10-22-demo', title: 'Browser task', workType: 'issue',
          phase: 'planning', stage: 'analyze', status: 'planning', steps: [], artifacts: [],
        }],
      },
    }) })
  })
  await page.addScriptTag({ content: instrumented })
  async function mount(seat, palette) {
    await page.evaluate(({ seat, palette }) => {
      window.root?.unmount()
      for (const [key, value] of Object.entries(palette)) document.body.style.setProperty(key, value)
      window.root = window.vendor.createRoot(document.getElementById(seat))
      const Component = seat === 'hero' ? window.modalTest.HeroTaskChip : window.modalTest.TaskChip
      window.root.render(window.vendor.react.createElement(Component, {
        session: { blank: true }, sessionId: 'fixture', t: (key) => window.modalTest.zh[key] || key,
      }))
    }, { seat, palette })
    await page.locator('.tw-chip[aria-haspopup="dialog"]').waitFor()
  }
  async function expand() {
    await page.locator('.tw-chip').click()
    await page.getByRole('button', { name: '展开大看板', exact: true }).click()
    await page.getByRole('dialog', { name: 'Trellis 任务看板' }).waitFor()
    // Wait for the real modal entry animation, not a fixed delay.
    await page.evaluate(() => Promise.all(document.getAnimations().filter((a) =>
      a.effect?.target?.matches('.tw-overlay, .tw-modal')).map((a) => a.finished)))
  }
  async function verifyGeometry(label) {
    const geometry = await page.evaluate(() => {
      const overlay = document.querySelector('.tw-overlay')
      const modal = document.querySelector('.tw-modal')
      const rect = (el) => {
        const { x, y, width, height } = el.getBoundingClientRect()
        return { x, y, width, height }
      }
      return { overlay: rect(overlay), modal: rect(modal),
        atBody: overlay.parentElement === document.body,
        topHit: overlay.contains(document.elementFromPoint(5, 5)),
        background: getComputedStyle(modal).backgroundColor }
    })
    console.log(label, JSON.stringify(geometry))
    assert.ok(Math.abs(geometry.overlay.x) < 1 && Math.abs(geometry.overlay.y) < 1,
      label + ': expanded overlay must originate at viewport (0,0)')
    assert.ok(Math.abs(geometry.overlay.width - 1733) < 1 && Math.abs(geometry.overlay.height - 827) < 1,
      label + ': expanded overlay must cover viewport')
    assert.ok(Math.abs(geometry.modal.x + geometry.modal.width / 2 - 1733 / 2) < 1,
      label + ': modal must be horizontally centered')
    assert.ok(Math.abs(geometry.modal.y + geometry.modal.height / 2 - 827 / 2) < 1,
      label + ': modal must be vertically centered')
    assert.equal(geometry.atBody, true, label + ': overlay must escape seat ancestors')
    assert.equal(geometry.topHit, true, label + ': backdrop must intercept viewport clicks')
  }
  for (const [mode, palette] of Object.entries({ light: palettes.light, dark: palettes.dark })) {
    for (const seat of ['header', 'hero']) {
      await mount(seat, palette)
      await expand()
      await verifyGeometry(mode + '/' + seat)
      // Dialog content clicks must not dismiss it; search still works.
      await page.getByRole('searchbox').fill('Browser')
      assert.equal(await page.locator('.tw-tr').count(), 1)
      await page.getByRole('searchbox').fill('no such task')
      assert.equal(await page.locator('.tw-tr').count(), 0)
      await page.getByRole('searchbox').fill('')
      await page.getByRole('searchbox').blur()
      await page.keyboard.press('Control+k')
      assert.equal(await page.getByRole('searchbox').evaluate((el) => el === document.activeElement), true)
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('.tw-overlay').count(), 0)
      await expand()
      await page.mouse.click(5, 5)
      assert.equal(await page.locator('.tw-overlay').count(), 0)
      await expand()
      await page.getByRole('button', { name: '关闭', exact: true }).click()
      assert.equal(await page.locator('.tw-overlay').count(), 0)
      // Paint containment, clipping and lower stacking context cannot trap it.
      await page.evaluate((seat) => Object.assign(document.getElementById(seat).style, {
        transform: 'translateZ(0)', overflow: 'hidden', contain: 'paint', zIndex: '1',
      }), seat)
      // Expand via DOM click: clipping the test seat can hide its own chip.
      await page.locator('.tw-chip').evaluate((el) => el.click())
      await page.getByRole('button', { name: '展开大看板', exact: true }).evaluate((el) => el.click())
      await page.evaluate(() => Promise.all(document.getAnimations().filter((a) =>
        a.effect?.target?.matches('.tw-overlay, .tw-modal')).map((a) => a.finished)))
      await verifyGeometry(mode + '/' + seat + '/contained')
      await page.keyboard.press('Escape')
      await page.evaluate((seat) => document.getElementById(seat).removeAttribute('style'), seat)
    }
  }
  await expand()
  await page.evaluate((palette) => {
    for (const [key, value] of Object.entries(palette)) document.body.style.setProperty(key, value)
  }, palettes.light)
  assert.equal(await page.locator('.tw-modal').evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)')
  await page.evaluate((palette) => {
    for (const [key, value] of Object.entries(palette)) document.body.style.setProperty(key, value)
  }, palettes.dark)
  assert.equal(await page.locator('.tw-modal').evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(35, 35, 36)')
  await page.evaluate(() => window.root.unmount())
  assert.equal(await page.locator('.tw-overlay').count(), 0, 'unmount must clean up an open body portal')
  assert.deepEqual(errors, [])
  console.log('PASS: body portal geometry, both seats, theme tokens, interactions and cleanup')
} finally {
  await browser.close()
}
