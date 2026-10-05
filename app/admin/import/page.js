'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { errMsg } from '../../../lib/helpers'

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

const PRICE_RE = /(?:₹|rs\.?|inr)?\s*([0-9]{1,4})(?:\.([0-9]{2}))?\s*(?:\/-)?\s*$/i
const PRICE_ONLY_RE = /^[\s₹]*(?:rs\.?|inr)?\s*[0-9]{1,4}(?:\.[0-9]{2})?\s*(?:\/-)?$/i
const HEAD_RE = /^[A-Za-z][A-Za-z\s&'-]{1,28}$/
const NOISE = /^(page|gst|cgst|sgst|tax|total|address|phone|call|timings|open|closed|order online|www|http|scan|follow|fssai|gstin|wifi)/i

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib
  await new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = PDFJS; s.onload = res
    s.onerror = () => rej(new Error('Could not load the PDF engine — check your connection'))
    document.head.appendChild(s)
  })
  try {
    const r = await fetch(PDFJS_WORKER)
    const t = await r.text()
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([t], { type: 'application/javascript' }))
  } catch (e) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER
  }
  return window.pdfjsLib
}

export default function ImportMenu() {
  const [phase, setPhase] = useState('loading')
  const [loadErr, setLoadErr] = useState('')
  const [rest, setRest] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const [existing, setExisting] = useState(new Set())
  const [cands, setCands] = useState(null)
  const [rawLines, setRawLines] = useState([])
  const [showRaw, setShowRaw] = useState(false)
  const [imported, setImported] = useState(0)
  const [pasteText, setPasteText] = useState('')
  const [bulkCat, setBulkCat] = useState('')

  useEffect(() => { (async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    const { data: ru } = await supabase.from('restaurant_users')
      .select('*, restaurants(name)').eq('user_id', session.user.id).limit(1)
    if (!ru?.length || ru[0].role === 'staff') { window.location.href = '/admin'; return }
    setRest(ru[0].restaurants)
    const { data: mi } = await supabase.from('menu_items').select('name').eq('restaurant_id', ru[0].restaurant_id)
    setExisting(new Set((mi || []).map(x => (x.name || '').toLowerCase())))
    setPhase('ready')
  })() }, [])

  function guardName(name) {
    if (name.length < 2) return null
    if ((name.match(/[A-Za-z]/g) || []).length < 2) return null
    if (/\d[A-Za-z]/.test(name)) return null
    return name
  }

  function parseMenuLines(lines) {
    const out = []
    let cat = ''
    lines.forEach(raw => {
      const line = String(raw).replace(/\s+/g, ' ').trim()
      if (!line || line.length < 2) return
      const m = line.match(PRICE_RE)
      if (m) {
        if (/\d{5,}/.test(line)) return
        if (/^(www|http)/i.test(line)) return
        const price = parseFloat(m[1] + (m[2] ? '.' + m[2] : ''))
        let name = line.slice(0, m.index)
          .replace(/[.\-–—_·•/]+\s*$/, '')
          .replace(/^(₹|rs\.?|inr)\s*/i, '')
          .replace(/\s{2,}/g, ' ').trim()
        name = guardName(name)
        if (name && price >= 5 && price <= 9999) {
          const dup = existing.has(name.toLowerCase())
          out.push({ name, price, category: cat, include: !dup, dup })
        }
        return
      }
      if (NOISE.test(line)) return
      if (!/[0-9@]/.test(line) && line.length <= 30 && HEAD_RE.test(line)) {
        cat = line.toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase())
      }
    })
    return out
  }

  function parseAndShow(lines) {
    setRawLines(lines)
    const c = parseMenuLines(lines)
    setCands(c)
    if (!c.length) setErr('Parsed the text but found no item+price pairs. Check the extracted lines below — if they look scrambled, paste the menu text instead.')
    else setMsg(c.length + ' possible items found — review prices and untick anything wrong before importing.')
  }

  async function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true); setErr(''); setMsg(''); setImported(0); setCands(null)
    try {
      const pdfjsLib = await loadPdfJs()
      const buf = await f.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise
      const lines = []
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const tc = await page.getTextContent()
        const rows = {}
        tc.items.forEach(it => {
          if (!it.str || !it.str.trim()) return
          const x = it.transform[4]
          const y = Math.round(it.transform[5] / 2) * 2
          if (!rows[y]) rows[y] = []
          rows[y].push({ str: it.str, x, w: it.width })
        })
        Object.keys(rows).map(Number).sort((a, b) => b - a).forEach(y => {
          const items = rows[y].sort((a, b) => a.x - b.x)
          const segs = []
          let cur = [items[0]]
          for (let i = 1; i < items.length; i++) {
            const prev = cur[cur.length - 1]
            if (items[i].x - (prev.x + prev.w) > 30) { segs.push(cur); cur = [items[i]] }
            else cur.push(items[i])
          }
          segs.push(cur)
          const texts = segs.map(seg => {
            let t = ''
            seg.forEach((it, idx) => {
              if (idx > 0 && it.x - (seg[idx - 1].x + seg[idx - 1].w) > 1.5) t += ' '
              t += it.str
            })
            return t.replace(/\s+/g, ' ').trim()
          }).filter(Boolean)
          for (let i = 1; i < texts.length; i++) {
            if (PRICE_ONLY_RE.test(texts[i]) && !PRICE_RE.test(texts[i - 1])) {
              texts[i - 1] = texts[i - 1] + ' ' + texts[i]
              texts.splice(i, 1); i--
            }
          }
          texts.forEach(t => { if (t.length >= 2) lines.push(t) })
        })
      }
      if (!lines.length) {
        setErr('No text found in this PDF — it looks like a scan or photo. Export the menu as a text PDF from your design tool (Canva, Word, InDesign) and try again, or paste the menu text below.')
      } else {
        parseAndShow(lines)
      }
    } catch (ex) {
      setErr('Could not read that PDF. ' + errMsg(ex))
    }
    setBusy(false)
  }

  function parsePasted() {
    setErr(''); setMsg(''); setImported(0)
    const lines = pasteText.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    if (!lines.length) return setErr('Paste some menu text first.')
    parseAndShow(lines)
  }

  function upd(i, field, val) {
    setCands(cs => cs.map((c, j) => j === i ? { ...c, [field]: val } : c))
  }
  function applyBulkCat() {
    if (!bulkCat.trim()) return
    setCands(cs => cs.map(c => c.include ? { ...c, category: bulkCat.trim() } : c))
  }
  async function doImport() {
    const rows = (cands || []).filter(c => c.include && c.name.trim() && c.price > 0)
      .map(c => ({ restaurant_id: rest.id, name: c.name.trim(), category: (c.category || '').trim() || null, price_paise: Math.round(c.price * 100), active: true }))
    if (!rows.length) return setErr('Nothing selected — tick at least one row with a valid price.')
    setBusy(true); setErr('')
    const { error } = await supabase.from('menu_items').insert(rows)
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setImported(rows.length); setCands(null); setRawLines([])
  }

  if (phase === 'loading') return <div className="wrap"><p className="muted">Loading…</p></div>
  if (loadErr) return <div className="wrap"><div className="err sm">{loadErr}</div></div>

  const checked = (cands || []).filter(c => c.include && c.name.trim() && c.price > 0).length

  return <div className="wrap">
    <div className="spread" style={{ marginBottom: 14 }}>
      <h1>Import menu</h1>
      <a className="btn slim" href="/admin">Back to admin</a>
    </div>
    {msg && <div className="ok sm">{msg}</div>}
    {err && <div className="err sm">{err}</div>}
    {imported > 0 && <div className="ok sm">{imported} item(s) imported. Set cost prices in Admin → Menu to unlock margin tracking.</div>}

    <div className="card">
      <h2>1. Upload a menu PDF</h2>
      <p className="sm muted">Works with text-based PDFs (exported from Canva, Word, InDesign). Photos/scans of menus have no text layer and cannot be read — paste the text instead. Nothing is imported until you review the preview below.</p>
      <input className="input" type="file" accept="application/pdf,.pdf" onChange={onFile} disabled={busy} />
      {busy && <p className="sm muted" style={{ marginTop: 8 }}>Reading and parsing…</p>}
    </div>

    <div className="card">
      <h2>…or paste menu text</h2>
      <p className="sm muted">One item per line, e.g. <b>Butter Chicken 350</b> or <b>Paneer Tikka ..... ₹280</b>. Section headings (like Starters) become categories.</p>
      <textarea className="input" rows={6} value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder={'STARTERS\nPaneer Tikka 280\nChicken 65 320\n\nMAIN COURSE\nButter Chicken 350'} />
      <div style={{ height: 10 }} />
      <button className="btn" disabled={busy} onClick={parsePasted}>Parse pasted text</button>
    </div>

    {cands && <div className="card">
      <h2>2. Review and import ({checked} selected)</h2>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn slim" onClick={() => setCands(cs => cs.map(c => ({ ...c, include: true })))}>Check all</button>
        <button className="btn slim" onClick={() => setCands(cs => cs.map(c => ({ ...c, include: false })))}>Uncheck all</button>
        <input className="input" style={{ width: 150 }} placeholder="Category for checked" value={bulkCat} onChange={e => setBulkCat(e.target.value)} />
        <button className="btn slim" onClick={applyBulkCat}>Apply</button>
      </div>
      <div style={{ height: 10 }} />
      {cands.map((c, i) => <div key={i} className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1', gap: 8, flexWrap: 'wrap' }}>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={c.include} onChange={e => upd(i, 'include', e.target.checked)} />
          <span className="chip r">{c.dup ? 'already on menu' : ''}</span>
        </label>
        <input className="input grow" style={{ minWidth: 140 }} value={c.name} onChange={e => upd(i, 'name', e.target.value)} />
        <input className="input" style={{ width: 90 }} type="number" step="0.01" value={c.price} onChange={e => upd(i, 'price', parseFloat(e.target.value))} />
        <input className="input" style={{ width: 120 }} placeholder="Category" value={c.category} onChange={e => upd(i, 'category', e.target.value)} />
      </div>)}
      {cands.length === 0 && <p className="sm muted">Nothing detected.</p>}
      <div style={{ height: 12 }} />
      <button className="btn primary" disabled={busy || checked === 0} onClick={doImport}>
        {busy ? 'Importing…' : 'Import ' + checked + ' item(s)'}
      </button>
    </div>}

    {rawLines.length > 0 && <div className="card">
      <details className="sec">
        <summary className="sm">Extracted lines ({rawLines.length}) — for debugging misses</summary>
        <div className="xs muted" style={{ marginTop: 8, maxHeight: 200, overflow: 'auto' }}>
          {rawLines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </details>
    </div>}
  </div>
}
