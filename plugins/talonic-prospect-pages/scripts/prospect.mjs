#!/usr/bin/env node
// Talonic prospect pages CLI. Dependency-free Node 18+. Talks to
// https://talonic.com/api/prospects (src/lib/prospects/api.ts in the website
// repo) and prints PDFs with the Google Chrome already on the machine.
//
//   prospect login --key tpk_…            store your publish key (~/.config/talonic/prospect.json)
//   prospect whoami
//   prospect list
//   prospect info <slug>                   versions, who published what, current and draft
//   prospect screens                       the render service's screen library (ids, highlight boxes)
//   prospect video <workdir> [--storyboard f] [--out dir]
//                                          render <workdir>/storyboard.json on the render service into
//                                          <workdir>/walkthrough.mp4 and poster.jpg (1–3 min)
//   prospect build <workdir> [--pdf-name Talonic-Acme-Pilot.pdf]
//                                          <workdir>/page.html → build/page.html (images inlined,
//                                          video block dropped without walkthrough.mp4) + build/<pdf>
//   prospect preview <workdir> [--no-open] build, then write build/preview.html with the video and
//                                          PDF links pointing at the local files and open it in the
//                                          browser. Nothing leaves the machine.
//   prospect draft <slug> [--page f] [--pdf f] [--slides-pdf f] [--logo f] [--media f …]
//                  [--password p] [--title t] [--heading h] [--customer c] [--pdf-name n]
//                  [--slides-pdf-name n] [--note n] [--keep pdf,slidesPdf,media,logo] [--force]
//                                          upload a new version as the draft (talonic.com/<slug>/draft)
//   prospect draft <slug> --work <workdir> same, taking page/pdf/logo/media from build/ and <workdir>
//   prospect publish <slug> [--version n]  make the draft (or version n) live at talonic.com/<slug>
//   prospect rollback <slug> --version n
//   prospect password <slug> --password p  rotate (signs every reader out)
//   prospect pull <slug> [--version n] [--out dir]  download a version's files to edit
//   prospect delete <slug>
//   prospect keys list | create <email> | revoke <id>    (admin secret)
//
// Env: TALONIC_PROSPECT_KEY overrides the stored key; TALONIC_PROSPECT_API
// overrides the API base (local harness: http://localhost:8797/api/prospects);
// TALONIC_RENDER_API overrides the render service (default
// https://prospect-render-production.up.railway.app, set with `prospect login --render-api`).
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { homedir, platform, tmpdir } from 'node:os'
import { basename, dirname, extname, resolve } from 'node:path'

const CONFIG = resolve(homedir(), '.config/talonic/prospect.json')
const SELF = fileURLToPath(new URL('.', import.meta.url)) // not .pathname: it keeps %20 for paths with spaces
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf', '.woff2': 'font/woff2' }

const fail = (msg) => {
  console.error(`prospect: ${msg}`)
  process.exit(1)
}

function parse(argv) {
  const pos = []
  const opts = { media: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      pos.push(a)
      continue
    }
    const key = a.slice(2).replace(/-(.)/g, (_, c) => c.toUpperCase())
    if (key === 'media') {
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) opts.media.push(argv[++i])
    } else if (key === 'force' || key === 'json' || key === 'noPdf' || key === 'noOpen') {
      opts[key] = true
    } else {
      opts[key] = argv[++i]
    }
  }
  return { pos, opts }
}

function config() {
  try {
    return JSON.parse(readFileSync(CONFIG, 'utf8'))
  } catch {
    return {}
  }
}

function api() {
  const c = config()
  const base = (process.env.TALONIC_PROSPECT_API ?? c.api ?? 'https://talonic.com/api/prospects').replace(/\/$/, '')
  const key = process.env.TALONIC_PROSPECT_KEY ?? c.key
  if (!key) fail('no publish key. Run `prospect login --key tpk_…` (ask an admin for a key), or set TALONIC_PROSPECT_KEY.')
  return { base, key }
}

async function call(method, path, body, headers = {}) {
  const { base, key } = api()
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...headers },
    body,
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { error: text.slice(0, 300) }
  }
  if (!res.ok) fail(`${method} ${path} → ${res.status}: ${data.error ?? text.slice(0, 200)}`)
  return data
}

const fileField = (form, field, path, name) => {
  if (!path) return
  name ??= basename(path)
  if (!existsSync(path)) fail(`${field}: ${path} not found`)
  form.append(field, new Blob([readFileSync(path)], { type: TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream' }), name)
}

const dataUri = (file) => `data:${TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}`

// ---- build -----------------------------------------------------------------

function findChrome() {
  const env = process.env.CHROME_PATH
  if (env && existsSync(env)) return env
  const candidates =
    platform() === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', `${homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, '/Applications/Chromium.app/Contents/MacOS/Chromium']
      : platform() === 'win32'
        ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe']
        : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium']
  return candidates.find((c) => existsSync(c))
}

function inlineImages(html, work, assetsRoot) {
  return html.replace(/(<img\b[^>]*?\bsrc=")([^"]+)(")/g, (m, a, url, b) => {
    if (/^(data:|https?:|__MEDIA__)/.test(url)) return m
    const file = url.startsWith('/') ? resolve(assetsRoot, url.slice(1)) : resolve(work, url)
    if (!existsSync(file)) fail(`image not found: ${url} (looked for ${file}). Logos ship with the plugin under assets/; anything else goes in the work folder.`)
    return a + dataUri(file) + b
  })
}

const VIDEO = /<!-- video -->[\s\S]*?<!-- \/video -->/

function build(work, opts) {
  work = resolve(work)
  const src = `${work}/page.html`
  if (!existsSync(src)) fail(`${src} not found`)
  const assets = resolve(SELF, '../assets')
  let html = readFileSync(src, 'utf8')
  const hasVideo = existsSync(`${work}/walkthrough.mp4`)
  const hasPoster = existsSync(`${work}/poster.jpg`)
  if (VIDEO.test(html) && !hasVideo) html = html.replace(VIDEO, '')
  if (!VIDEO.test(html) && hasVideo) console.warn('prospect build: walkthrough.mp4 exists but page.html has no <!-- video --> block')

  const page = inlineImages(html, work, assets)
  const left = page.match(/\b(?:src|href)="(?!data:|https?:|mailto:|tel:|#|__MEDIA__|__PDF_URL__|__SLIDES_PDF_URL__)[^"]*"/g)
  if (left) fail(`unresolved local references: ${left.slice(0, 3).join(', ')}`)

  const slug = (page.match(/talonic\.com\/([a-z0-9-]+)/) ?? [])[1] ?? opts.slug ?? 'this page'
  const still = hasPoster
    ? `<section class="video-still"><img src="${dataUri(`${work}/poster.jpg`)}" alt="Video still"><p class="note">Watch the walkthrough at talonic.com/${slug}.</p></section>`
    : ''
  const print = inlineImages(html.replace(VIDEO, still), work, assets).replace(/<a[^>]*href="__PDF_URL__"[^>]*>[\s\S]*?<\/a>/g, '')

  mkdirSync(`${work}/build`, { recursive: true })
  writeFileSync(`${work}/build/page.html`, page)
  writeFileSync(`${work}/build/print.html`, print)
  const pdfName = opts.pdfName ?? 'page.pdf'
  const pdfPath = `${work}/build/${pdfName}`
  if (!opts.noPdf) {
    const chrome = findChrome()
    if (!chrome) fail('Google Chrome is needed to print the PDF (set CHROME_PATH if it is installed somewhere unusual), or pass --no-pdf.')
    // Chrome's exit code is unreliable on macOS (teardown watchdog), so the
    // file is the signal. A throwaway profile avoids touching the user's.
    const profile = resolve(tmpdir(), `talonic-prospect-chrome-${process.pid}`)
    const r = spawnSync(
      chrome,
      ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', `--user-data-dir=${profile}`, '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw', '--virtual-time-budget=8000', `--print-to-pdf=${pdfPath}`, `file://${work}/build/print.html`],
      { stdio: 'pipe', timeout: 120000 },
    )
    rmSync(profile, { recursive: true, force: true })
    if (!existsSync(pdfPath) || statSync(pdfPath).size < 1000) fail(`Chrome could not print the PDF: ${String(r.stderr).slice(-400)}`)
  }
  console.log(`Built ${work}/build/`)
  console.log(`  page.html   ${Math.round(page.length / 1024)} KB${hasVideo ? ', with video' : ', no video'}`)
  if (!opts.noPdf) console.log(`  ${pdfName}  ${Math.round(statSync(pdfPath).size / 1024)} KB, PDF without the video${hasPoster ? ', poster still instead' : ''}`)
  return { page: `${work}/build/page.html`, pdf: opts.noPdf ? null : pdfPath, hasVideo, hasPoster }
}

function preview(work, opts) {
  work = resolve(work)
  const b = build(work, opts)
  let html = readFileSync(b.page, 'utf8')
  html = html.replace(/__MEDIA__\//g, '../').replace(/__PDF_URL__/g, b.pdf ? `./${basename(b.pdf)}` : '#')
  const slides = readdirSync(`${work}/build`).find((f) => /slides.*\.pdf$/i.test(f))
  html = html.replace(/__SLIDES_PDF_URL__/g, slides ? `./${slides}` : '#')
  const out = `${work}/build/preview.html`
  writeFileSync(out, html)
  console.log(`Preview ${out}`)
  console.log(`  video ${b.hasVideo ? 'from ../walkthrough.mp4' : 'absent (no walkthrough.mp4)'}, PDF link ${b.pdf ? `to ./${basename(b.pdf)}` : 'disabled (--no-pdf)'}`)
  if (!opts.noOpen) {
    const opener = platform() === 'darwin' ? ['open', [out]] : platform() === 'win32' ? ['cmd', ['/c', 'start', '', out]] : ['xdg-open', [out]]
    const r = spawnSync(opener[0], opener[1], { stdio: 'ignore' })
    if (r.error || r.status) console.log(`  could not open a browser; open the file yourself.`)
  }
  return out
}

// ---- commands --------------------------------------------------------------

const print = (obj) => console.log(JSON.stringify(obj, null, 2))

function summary(m) {
  const v = m.versions ?? []
  const lines = [`/${m.slug}  ${m.title}  (owner ${m.owner})`, `  live:  ${m.current == null ? 'not published' : `v${m.current}  ${m.urls.page}`}`, `  draft: ${m.draft == null ? 'none' : `v${m.draft}  ${m.urls.draft}`}`]
  for (const x of v) lines.push(`  v${x.n}  ${x.at.slice(0, 16).replace('T', ' ')}  ${x.by}  ${x.files.pdf ? 'pdf ' : ''}${x.files.slidesPdf ? 'slides ' : ''}${x.files.media.length ? `media(${x.files.media.join(',')}) ` : ''}${x.note ? `— ${x.note}` : ''}`)
  return lines.join('\n')
}

function renderApi() {
  const c = config()
  const base = (process.env.TALONIC_RENDER_API ?? c.renderApi ?? 'https://prospect-render-production.up.railway.app').replace(/\/$/, '')
  const key = process.env.TALONIC_PROSPECT_KEY ?? c.key
  if (!key) fail('no publish key (the render service accepts the same key).')
  return { base, key }
}

async function renderCall(method, path, body, headers = {}) {
  const { base, key } = renderApi()
  let res
  try {
    res = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${key}`, ...headers }, body })
  } catch (e) {
    fail(`render service unreachable at ${base}: ${e.message}. Build the page without the video for now, or set TALONIC_RENDER_API.`)
  }
  if (!res.ok) fail(`${method} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const commands = {
  async login(_, opts) {
    if (!opts.key?.startsWith('tpk_') && !opts.admin) fail('usage: prospect login --key tpk_…')
    mkdirSync(dirname(CONFIG), { recursive: true })
    const c = config()
    writeFileSync(CONFIG, JSON.stringify({ ...c, key: opts.key ?? c.key, ...(opts.api && { api: opts.api }), ...(opts.renderApi && { renderApi: opts.renderApi }) }, null, 2) + '\n', { mode: 0o600 })
    console.log(`Stored in ${CONFIG}`)
    await commands.whoami()
  },
  async whoami() {
    const { base } = api()
    const r = await call('GET', '')
    console.log(`Key works against ${base}. ${r.pages.length} page(s) visible.`)
  },
  async list(_, opts) {
    const r = await call('GET', '')
    if (opts.json) return print(r)
    for (const p of r.pages) console.log(`/${p.slug.padEnd(14)} ${p.current == null ? 'draft only' : `live v${p.current}`}${p.draft != null ? ` + draft v${p.draft}` : ''}   ${p.title}   ${p.owner}   ${p.updatedAt.slice(0, 10)}`)
    if (!r.pages.length) console.log('No pages yet.')
  },
  async info([slug], opts) {
    if (!slug) fail('usage: prospect info <slug>')
    const r = await call('GET', `/${slug}`)
    if (opts.json) return print(r)
    console.log(summary(r))
    console.log('  log:')
    for (const l of r.log.slice(-10)) console.log(`    ${l.at.slice(0, 16).replace('T', ' ')}  ${l.by}  ${l.action}${l.version != null ? ` v${l.version}` : ''}${l.forced ? ' (forced)' : ''}`)
  },
  async screens(_, opts) {
    const r = await (await renderCall('GET', '/screens')).json()
    if (opts.json) return print(r)
    for (const sc of r.screens) console.log(`${sc.id.padEnd(20)} ${sc.label}${sc.boxes?.length ? `   boxes: ${sc.boxes.map((b) => (typeof b === 'string' ? b : b.id)).join(', ')}` : ''}`)
  },
  async video([work], opts) {
    if (!work) fail('usage: prospect video <workdir> [--storyboard storyboard.json]')
    work = resolve(work)
    const sb = resolve(opts.storyboard ?? `${work}/storyboard.json`)
    if (!existsSync(sb)) fail(`${sb} not found; write it first (references/storyboard.md)`)
    const storyboard = JSON.parse(readFileSync(sb, 'utf8'))
    const logo = ['png', 'svg'].map((e) => `${work}/customer-logo.${e}`).find(existsSync)
    if (logo && !storyboard.logos?.customerLogoDataUri) storyboard.logos = { ...storyboard.logos, customerLogoDataUri: dataUri(logo) }
    const { jobId } = await (await renderCall('POST', '/render', JSON.stringify(storyboard), { 'Content-Type': 'application/json' })).json()
    process.stdout.write(`render job ${jobId} `)
    const t0 = Date.now()
    for (;;) {
      await sleep(4000)
      const j = await (await renderCall('GET', `/jobs/${jobId}`)).json()
      if (j.status === 'done') break
      if (j.status === 'failed') fail(`render failed: ${j.error}`)
      process.stdout.write(j.progress ? `${j.progress} ` : '.')
      if (Date.now() - t0 > 15 * 60 * 1000) fail('render took over 15 minutes; check the service')
    }
    const out = resolve(opts.out ?? work)
    mkdirSync(out, { recursive: true })
    for (const [file, path] of [['walkthrough.mp4', 'video.mp4'], ['poster.jpg', 'poster.jpg']]) {
      const res = await renderCall('GET', `/jobs/${jobId}/${path}`)
      writeFileSync(`${out}/${file}`, Buffer.from(await res.arrayBuffer()))
    }
    const meta = await (await renderCall('GET', `/jobs/${jobId}`)).json()
    console.log(`\nSaved ${out}/walkthrough.mp4 (${Math.round(statSync(`${out}/walkthrough.mp4`).size / 1024)} KB${meta.duration ? `, ${meta.duration} s` : ''}) and poster.jpg`)
  },
  async build([work], opts) {
    if (!work) fail('usage: prospect build <workdir> [--pdf-name <file.pdf>]')
    build(work, opts)
  },
  async preview([work], opts) {
    if (!work) fail('usage: prospect preview <workdir> [--pdf-name <file.pdf>] [--no-open]')
    preview(work, opts)
  },
  async draft([slug], opts) {
    if (!slug) fail('usage: prospect draft <slug> --page page.html … or --work <workdir>')
    const form = new FormData()
    let page = opts.page, pdf = opts.pdf, logo = opts.logo, media = opts.media
    if (opts.work) {
      const w = resolve(opts.work)
      page ??= `${w}/build/page.html`
      if (!existsSync(page)) fail(`${page} missing: run \`prospect build ${opts.work}\` first`)
      if (!pdf) {
        const pdfs = readdirSync(`${w}/build`).filter((f) => f.endsWith('.pdf'))
        if (pdfs.length === 1) pdf = `${w}/build/${pdfs[0]}`
        else if (pdfs.length > 1) fail(`several PDFs in ${w}/build; pass --pdf`)
      }
      logo ??= ['png', 'svg'].map((e) => `${w}/customer-logo.${e}`).find(existsSync)
      if (!media.length) media = ['walkthrough.mp4', 'poster.jpg'].map((f) => `${w}/${f}`).filter(existsSync)
      opts.pdfName ??= pdf ? basename(pdf) : undefined
    }
    fileField(form, 'page', page)
    fileField(form, 'pdf', pdf)
    fileField(form, 'slidesPdf', opts.slidesPdf)
    fileField(form, 'logo', logo)
    for (const m of media) fileField(form, 'media', m)
    for (const [k, v] of Object.entries({ password: opts.password, title: opts.title, heading: opts.heading, customer: opts.customer, pdfName: opts.pdfName, slidesPdfName: opts.slidesPdfName, note: opts.note, keep: opts.keep })) if (v) form.append(k, v)
    const r = await call('PUT', `/${slug}/draft`, form, opts.force ? { 'X-Prospect-Force': '1' } : {})
    if (opts.json) return print(r)
    console.log(`Draft v${r.version} of /${slug} uploaded.`)
    console.log(`  preview: ${r.draftUrl}  (password required)`)
    console.log(`  live:    ${r.current == null ? 'not published yet' : `v${r.current} unchanged`}`)
    console.log(`Publish with: prospect publish ${slug}`)
  },
  async publish([slug], opts) {
    if (!slug) fail('usage: prospect publish <slug> [--version n]')
    const r = await call('POST', `/${slug}/publish`, JSON.stringify(opts.version ? { version: Number(opts.version) } : {}), { 'Content-Type': 'application/json' })
    if (opts.json) return print(r)
    console.log(`Live: ${r.url}  (v${r.current})`)
  },
  async rollback([slug], opts) {
    if (!slug || !opts.version) fail('usage: prospect rollback <slug> --version n')
    const r = await call('POST', `/${slug}/rollback`, JSON.stringify({ version: Number(opts.version) }), { 'Content-Type': 'application/json' })
    if (opts.json) return print(r)
    console.log(`Live: ${r.url}  (now v${r.current})`)
  },
  async password([slug], opts) {
    if (!slug || !opts.password) fail('usage: prospect password <slug> --password <new>')
    const r = await call('PUT', `/${slug}/password`, JSON.stringify({ password: opts.password }), { 'Content-Type': 'application/json' })
    console.log(`Password changed for /${slug}; every reader is signed out.`)
    if (opts.json) print(r)
  },
  async delete([slug], opts) {
    if (!slug) fail('usage: prospect delete <slug>')
    const r = await call('DELETE', `/${slug}`)
    console.log(`/${slug} is offline (history kept).`)
    if (opts.json) print(r)
  },
  async pull([slug], opts) {
    if (!slug) fail('usage: prospect pull <slug> [--version n] [--out dir]')
    const m = await call('GET', `/${slug}`)
    const n = opts.version ? Number(opts.version) : (m.draft ?? m.current)
    const v = m.versions.find((x) => x.n === n)
    if (!v) fail(`no version ${n}`)
    const out = resolve(opts.out ?? `prospect-${slug}`)
    mkdirSync(out, { recursive: true })
    const { base, key } = api()
    const get = async (role, file) => {
      const res = await fetch(`${base}/${slug}/files/${n}/${role}`, { headers: { Authorization: `Bearer ${key}` } })
      if (!res.ok) fail(`download ${role}: ${res.status}`)
      writeFileSync(file, Buffer.from(await res.arrayBuffer()))
      console.log(`  ${file}`)
    }
    console.log(`Pulling /${slug} v${n} into ${out}/`)
    await get('page', `${out}/page.html`)
    if (v.files.pdf) await get('pdf', `${out}/${m.pdfFileName}`)
    if (v.files.slidesPdf) await get('slides-pdf', `${out}/${m.slidesPdfFileName}`)
    for (const name of v.files.media) await get(`media/${name}`, `${out}/${name}`)
    writeFileSync(`${out}/prospect.json`, JSON.stringify({ slug, version: n, title: m.title, heading: m.heading, customerName: m.customerName, pdfFileName: m.pdfFileName, slidesPdfFileName: m.slidesPdfFileName, owner: m.owner }, null, 2) + '\n')
    console.log('page.html already has images inlined and media links as /<slug>/media/…; edit it, then `prospect draft <slug> --page page.html`.')
  },
  async keys([action, arg], opts) {
    if (action === 'list') return print(await call('GET', '/keys'))
    if (action === 'create' && arg) {
      const r = await call('POST', '/keys', JSON.stringify({ email: arg }), { 'Content-Type': 'application/json' })
      console.log(`Key for ${r.email} (id ${r.id}). Send it over a secure channel; it is shown once:\n\n  ${r.key}\n\nThey run: prospect login --key ${r.key}`)
      return
    }
    if (action === 'revoke' && arg) return print(await call('DELETE', `/keys/${arg}`))
    fail('usage: prospect keys list | create <email> | revoke <id>   (needs the admin secret as the key)')
  },
}

const { pos, opts } = parse(process.argv.slice(2))
const [cmd, ...args] = pos
if (!cmd || !commands[cmd]) {
  console.error(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).slice(1, 30).map((l) => l.slice(3)).join('\n'))
  process.exit(cmd ? 1 : 0)
}
await commands[cmd](args, opts)
