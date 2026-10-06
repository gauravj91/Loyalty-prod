export const inr = p => p == null ? '—' : '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })
export const toPaise = v => Math.round(parseFloat(v || 0) * 100) || 0
export const fmtDate = iso => iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''
export const errMsg = e => e?.message || e?.error_description || String(e)

export function tierFor(pts, tiers) { let t = null; (tiers || []).forEach(x => { if (pts >= x.min) t = x }); return t }
export function nextTierFor(pts, tiers) {
  const ts = (tiers || []).slice().sort((a, b) => a.min - b.min)
  return ts.find(t => t.min > pts) || null
}

export function dayStart(daysAgo = 0) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// QR payload can be a full portal URL or a raw code — handle both
export function parseQr(text) {
  text = (text || '').trim()
  try {
    const u = new URL(text)
    const qr = u.searchParams.get('qr')
    if (qr) return { qr, secret: u.searchParams.get('k'), slug: u.searchParams.get('slug') }
  } catch {}
  return { qr: text }
}

export function customerLink(slug, qr, secret) {
  return `${window.location.origin}/customer?slug=${slug}&qr=${qr}&k=${secret}`
}
export function staffEmail(phone) {
  let d = String(phone || '').replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  d = d.replace(/^0+/, '')
  return 'staff.' + d + '@tessera.app'
}

export function downloadCsv(filename, rows) {
  const csv = rows.map(r => r.map(c => '"' + String(c ?? '').replaceAll('"', '""') + '"').join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = filename; a.click(); URL.revokeObjectURL(a.href)
}
