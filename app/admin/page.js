'use client'
import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { inr, toPaise, fmtDate, dayStart, tierFor, errMsg, customerLink, downloadCsv, staffEmail } from '../../lib/helpers'

const S = ({ title, children, open }) => (
  <details className="sec" open={open}><summary>{title}</summary><div style={{ paddingTop: 10 }}>{children}</div></details>
)

function Bars({ series }) {
  const max = Math.max(1, ...series.map(s => s.revenue))
  const step = series.length > 16 ? 5 : series.length > 8 ? 2 : 1
  return <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 130, marginTop: 12 }}>
    {series.map((s, i) => <div key={s.key} style={{ flex: 1, textAlign: 'center' }} title={inr(s.revenue) + ' · ' + s.bills + ' bills'}>
      <div style={{ height: Math.max(3, Math.round(s.revenue / max * 100)), background: 'linear-gradient(180deg,#C2511F,#E07A4A)', borderRadius: 4, transition: 'height .3s' }} />
      <div className="xs muted" style={{ marginTop: 4, visibility: (i % step === 0 || i === series.length - 1) ? 'visible' : 'hidden' }}>{s.label}</div>
    </div>)}
  </div>
}

function HBars({ items }) {
  const max = Math.max(1, ...items.map(i => i.value))
  return <div style={{ marginTop: 10 }}>
    {items.map(i => <div key={i.label} style={{ marginBottom: 8 }}>
      <div className="spread sm"><span>{i.label}</span><b className="num">{inr(i.value)}</b></div>
      <div className="bar"><div style={{ width: (i.value / max * 100) + '%', background: '#3D5A66' }} /></div>
    </div>)}
  </div>
}

function OutletTable({ rows }) {
  if (!rows.length) return <p className="sm muted">No outlet activity in this period.</p>
  return <table className="t"><thead><tr><th>Outlet</th><th>Sales</th><th>Bills</th><th>Avg bill</th><th>Wallet</th><th>Counter</th><th>Top-ups</th></tr></thead><tbody>
    {rows.map(r => <tr key={r.name}>
      <td><b>{r.name}</b></td>
      <td className="num">{inr(r.sales)}</td>
      <td className="num">{r.bills}</td>
      <td className="num">{inr(r.bills ? Math.round(r.sales / r.bills) : 0)}</td>
      <td className="num">{inr(r.wallet)}</td>
      <td className="num">{inr(r.counter)}</td>
      <td className="num">{inr(r.topups)}</td>
    </tr>)}
  </tbody></table>
}

export default function Admin() {
  const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [loadErr, setLoadErr] = useState('')
  const [rest, setRest] = useState(null); const [tab, setTab] = useState('overview')
  const [range, setRange] = useState(6); const [stats, setStats] = useState(null); const [ordersRaw, setOrdersRaw] = useState([]); const [wtxRaw, setWtxRaw] = useState([])
  const [outletNames, setOutletNames] = useState({})
  const [ws, setWs] = useState(null); const [wsF, setWsF] = useState({ name: 'Wallet offer', min: '500', bonus: '10', cap: '' })
  const [rules, setRules] = useState([]); const [ruleF, setRuleF] = useState({ name: '', target_type: 'item', target_value: '', required_count: '10', reward_type: 'free_item', reward_value: '1', reward_label: '' })
  const [pc, setPc] = useState(null); const [pcF, setPcF] = useState({ per100: '1', active: true, b0: '0', b1: '500', b2: '1000', b3: '2500' })
  const [rws, setRws] = useState([]); const [rwF, setRwF] = useState({ name: '', description: '', required_points: '500', max: '1' })
  const [staff, setStaff] = useState([]); const [stF, setStF] = useState({ email: '', role: 'staff', name: '', phone: '', pw: '' })
  const [q, setQ] = useState(''); const [custs, setCusts] = useState([]); const [sel, setSel] = useState(null)
  const [adjF, setAdjF] = useState({ amount: '', reason: '' }); const [link, setLink] = useState(null)
  const [outs, setOuts] = useState([]); const [outF, setOutF] = useState({ name: '', address: '', phone: '' })
  const [campSeg, setCampSeg] = useState('all'); const [campPts, setCampPts] = useState(100)
  const [campMsg, setCampMsg] = useState('Hi {name}! We miss you — visit us this week and treat yourself.'); const [campList, setCampList] = useState(null)
  const [campIdx, setCampIdx] = useState(0); const [sentIds, setSentIds] = useState([])
  const [menu, setMenu] = useState([]); const [miF, setMiF] = useState({ id: null, name: '', category: '', price: '', cost: '', active: true })
  const [mk, setMk] = useState(null); const [mkF, setMkF] = useState({ referrer: '100', referee: '100', birthday: '0' })
  const [bdays, setBdays] = useState([]); const [annivs, setAnnivs] = useState([]); const [claims, setClaims] = useState(new Set())
  const [fbList, setFbList] = useState([])
  const [todo, setTodo] = useState(null)
  const [mods, setMods] = useState({ wallet_on: true, stamps_on: true, points_on: true }); const [modsF, setModsF] = useState({ wallet_on: true, stamps_on: true, points_on: true })
  const [brandF, setBrandF] = useState({ logo: '', cover: '', terms: '' }); const [brandBusy, setBrandBusy] = useState(null)

  useEffect(() => { (async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    const { data: ru, error: ruErr } = await supabase.from('restaurant_users')
      .select('*, restaurants(*)').eq('user_id', session.user.id).limit(1)
    if (ruErr) { setLoadErr(errMsg(ruErr)); return }
    if (!ru?.length || ru[0].role === 'staff') { window.location.href = '/staff'; return }
    if (!ru[0].restaurants) { setLoadErr('Account linked, but the restaurant could not be loaded. Refresh and try again.'); return }
    setRest(ru[0].restaurants)
  })() }, [])

  useEffect(() => { if (!rest) return; loadOffers(); loadStaff(); loadOutlets() }, [rest])
  useEffect(() => { if (rest && tab === 'overview') { loadStats(); loadTodo() } }, [rest, tab, range])
  useEffect(() => { if (rest && tab === 'customers') searchCusts('') }, [rest, tab])
  useEffect(() => { if (rest && tab === 'campaigns') buildCampaign() }, [rest, tab, campSeg, campPts])
  useEffect(() => { if (rest && tab === 'menu') loadMenu() }, [rest, tab])
  useEffect(() => { if (rest && tab === 'marketing') loadMarketing() }, [rest, tab])
  useEffect(() => { if (rest && tab === 'settings') loadBranding() }, [rest, tab])

  async function loadBranding() {
    const { data } = await supabase.from('restaurants').select('logo_url, cover_url, rewards_terms').eq('id', rest.id).single()
    setBrandF({ logo: data?.logo_url || '', cover: data?.cover_url || '', terms: data?.rewards_terms || '' })
  }
  async function uploadBrand(e, kind) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) return setErr('Image too large — keep it under 4 MB.')
    setErr(''); setMsg(''); setBrandBusy(kind)
    try {
      const path = rest.id + '/' + kind + '-' + Date.now()
      const { error: upErr } = await supabase.storage.from('branding').upload(path, file, { contentType: file.type })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('branding').getPublicUrl(path)
      const url = data.publicUrl
      const next = { logo: kind === 'logo' ? url : brandF.logo, cover: kind === 'cover' ? url : brandF.cover, terms: brandF.terms }
      const { error } = await supabase.rpc('update_branding', { p_restaurant_id: rest.id, p_logo_url: next.logo, p_cover_url: next.cover, p_rewards_terms: next.terms })
      if (error) throw error
      setBrandF(next)
      flash(kind === 'logo' ? 'Logo updated' : 'Cover photo updated')
    } catch (ex) { setErr(errMsg(ex)) }
    setBrandBusy(null)
  }
  async function saveTerms() {
    const { error } = await supabase.rpc('update_branding', {
      p_restaurant_id: rest.id, p_logo_url: brandF.logo, p_cover_url: brandF.cover, p_rewards_terms: brandF.terms,
    })
    error ? setErr(errMsg(error)) : flash('Terms saved')
  }

  async function loadTodo() {
    const t0 = dayStart(0), y0 = dayStart(1)
    const [cs, fbq, fbid, orq, wtq, oidle, mkq] = await Promise.all([
      supabase.from('customers').select('id, name, phone, birth_date, anniversary_date, qr_code, qr_secret').eq('restaurant_id', rest.id).limit(500),
      supabase.from('feedback').select('stars, order_id, created_at, customers(name)').eq('restaurant_id', rest.id).gte('created_at', dayStart(6)).order('created_at', { ascending: false }).limit(50),
      supabase.from('feedback').select('order_id').eq('restaurant_id', rest.id).gte('created_at', dayStart(6)),
      supabase.from('orders').select('id, total_paise, other_paid_paise, payment_method, created_at, customer_id, customers(name)').eq('restaurant_id', rest.id).gte('created_at', y0).order('created_at', { ascending: false }).limit(300),
      supabase.from('wallet_transactions').select('amount_paise, payment_method, created_at').eq('restaurant_id', rest.id).eq('type', 'topup').gte('created_at', y0),
      supabase.from('orders').select('customer_id, created_at').eq('restaurant_id', rest.id).order('created_at', { ascending: false }).limit(1000),
      supabase.from('marketing_config').select('*').eq('restaurant_id', rest.id).maybeSingle(),
    ])
    if (mkq.data) setMk(mkq.data)
    const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0)
    const rows = cs.data || []
    const cMap = {}; rows.forEach(c => cMap[c.id] = c)
    const yOrds = (orq.data || []).filter(o => new Date(o.created_at) < new Date(t0))
    const yCash = yOrds.filter(o => o.payment_method === 'cash').reduce((s, o) => s + o.other_paid_paise, 0)
      + (wtq.data || []).filter(x => x.payment_method === 'cash' && new Date(x.created_at) < new Date(t0)).reduce((s, x) => s + x.amount_paise, 0)
    const occ = ds => { if (!ds) return null; const d = new Date(ds + 'T00:00:00'); let o = new Date(todayMid.getFullYear(), d.getMonth(), d.getDate()); if (o < todayMid) o = new Date(todayMid.getFullYear() + 1, d.getMonth(), d.getDate()); return o }
    const withOcc = (list, field) => list.map(c => ({ ...c, _o: occ(c[field]) })).filter(c => c._o && (c._o - todayMid) <= 7 * 86400000).sort((a, b) => a._o - b._o)
    const bdays = withOcc(rows.filter(c => c.birth_date), 'birth_date').map(c => {
      const d = new Date(c.birth_date + 'T00:00:00')
      return { ...c, today: d.getDate() === todayMid.getDate() && d.getMonth() === todayMid.getMonth() }
    })
    const annivs = withOcc(rows.filter(c => c.anniversary_date), 'anniversary_date')
    const bad = (fbq.data || []).filter(f => f.stars <= 2)
    const fbSet = new Set((fbid.data || []).map(x => x.order_id))
    const noFb = (orq.data || []).filter(o => o.customer_id && !fbSet.has(o.id)).slice(0, 5)
    const lastVisit = {}
    ;(oidle.data || []).forEach(o => { if (o.customer_id && !lastVisit[o.customer_id]) lastVisit[o.customer_id] = o.created_at })
    const idle = rows.filter(c => { const lv = lastVisit[c.id]; return !lv || (Date.now() - new Date(lv).getTime()) > 14 * 86400000 }).length
    setTodo({ ySales: yOrds.reduce((s, o) => s + o.total_paise, 0), yBills: yOrds.length, yCash, bdays, annivs, bad, noFb, idle, cMap })
  }
  async function creditBday(c) {
    if (!confirm('Credit the birthday bonus to ' + (c.name || 'this customer') + '? Once per year.')) return
    const { error } = await supabase.rpc('claim_birthday', { p_restaurant_id: rest.id, p_customer_id: c.id })
    error ? setErr(errMsg(error)) : flash('Birthday credit given')
    loadTodo()
  }
  function waNum(p) { let d = (p || '').replace(/\D/g, ''); if (d.length === 10) d = '91' + d; return d }

  async function loadStats() {
    const from = dayStart(range)
    const [o, w, cb, ol] = await Promise.all([
      supabase.from('orders').select('*').eq('restaurant_id', rest.id).gte('created_at', from).order('created_at', { ascending: false }),
      supabase.from('wallet_transactions').select('*').eq('restaurant_id', rest.id).gte('created_at', from).order('created_at', { ascending: false }),
      supabase.from('customers').select('id, wallet_balance_paise, created_at').eq('restaurant_id', rest.id),
      supabase.from('outlets').select('id, name').eq('restaurant_id', rest.id),
    ])
    const ords = o.data || []; const wtx = w.data || []; const custRows = cb.data || []
    const oName = {}; (ol.data || []).forEach(x => oName[x.id] = x.name)
    setOutletNames(oName)

    const byMethod = {}
    ords.forEach(x => { byMethod[x.payment_method] = (byMethod[x.payment_method] || 0) + x.other_paid_paise })
    const itemAgg = {}
    ords.forEach(x => (x.items || []).forEach(it => {
      if (!itemAgg[it.name]) itemAgg[it.name] = { qty: 0, amt: 0 }
      itemAgg[it.name].qty += it.qty; itemAgg[it.name].amt += it.qty * it.unit_price_paise
    }))
    const tops = wtx.filter(x => x.type === 'topup')

    const byOutlet = {}
    const ensure = k => { if (!byOutlet[k]) byOutlet[k] = { name: oName[k] || 'Unassigned', sales: 0, bills: 0, wallet: 0, counter: 0, topups: 0, custSet: new Set() }; return byOutlet[k] }
    ords.forEach(x => { const r = ensure(x.outlet_id || 'none'); r.sales += x.total_paise; r.bills++; r.wallet += x.wallet_paid_paise; r.counter += x.other_paid_paise; if (x.customer_id) r.custSet.add(x.customer_id) })
    tops.forEach(x => { const r = ensure(x.outlet_id || 'none'); r.topups += x.amount_paise + (x.bonus_paise || 0) })

    const byStaff = {}
    ords.forEach(x => { const k = x.created_by_name || '—'; const r = byStaff[k] = byStaff[k] || { bills: 0, sales: 0, wallet: 0 }; r.bills++; r.sales += x.total_paise; r.wallet += x.wallet_paid_paise })
    const staffRows = Object.entries(byStaff).map(([name, v]) => ({ name, bills: v.bills, sales: v.sales, wallet: v.wallet, avg: v.bills ? Math.round(v.sales / v.bills) : 0 })).sort((a, b) => b.sales - a.sales)

    const days = range === 0 ? 1 : range + 1
    const dkey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    const series = []
    for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); series.push({ key: dkey(d), label: d.getDate() + '', revenue: 0, bills: 0 }) }
    const dayMap = {}; series.forEach(s => dayMap[s.key] = s)
    ords.forEach(x => { const s = dayMap[dkey(new Date(x.created_at))]; if (s) { s.revenue += x.total_paise; s.bills++ } })

    const fromMs = new Date(from).getTime()
    const custMeta = {}; custRows.forEach(c => custMeta[c.id] = c)
    const active = new Set(ords.map(x => x.customer_id).filter(Boolean))
    const newC = custRows.filter(c => new Date(c.created_at).getTime() >= fromMs).length
    const retC = [...active].filter(id => custMeta[id] && new Date(custMeta[id].created_at).getTime() < fromMs).length

    let costKnown = 0, revKnown = 0
    ords.forEach(o => (o.items || []).forEach(it => {
      if (it.cost_paise != null && !it.free) { costKnown += it.qty * it.cost_paise; revKnown += it.qty * it.unit_price_paise }
    }))

    const revenue = ords.reduce((s, x) => s + x.total_paise, 0)
    const bills = ords.length
    setStats({
      revenue, bills,
      customers: active.size,
      walletSales: ords.reduce((s, x) => s + x.wallet_paid_paise, 0),
      byMethod, itemAgg,
      topups: tops.reduce((s, x) => s + x.amount_paise + x.bonus_paise, 0),
      topupCash: tops.reduce((s, x) => s + x.amount_paise, 0),
      bonusGiven: tops.reduce((s, x) => s + (x.bonus_paise || 0), 0),
      points: ords.reduce((s, x) => s + x.points_earned, 0),
      cashHandover: (byMethod['cash'] || 0) + tops.filter(x => x.payment_method === 'cash').reduce((s, x) => s + x.amount_paise, 0),
      walletLiability: custRows.reduce((s, x) => s + x.wallet_balance_paise, 0),
      series, staffRows,
      newC, retC,
      avgBill: bills ? Math.round(revenue / bills) : 0,
      costKnown, revKnown,
      outlets: Object.values(byOutlet).map(v => ({ ...v, customers: v.custSet.size })).sort((a, b) => b.sales - a.sales),
    })
    setOrdersRaw(ords); setWtxRaw(wtx)
  }

  async function loadMenu() {
    const { data } = await supabase.from('menu_items').select('*').eq('restaurant_id', rest.id).order('category').order('name')
    setMenu(data || [])
  }
  async function loadMarketing() {
    const y = new Date().getFullYear(); const m = new Date().getMonth()
    const [mkq, cs, bc, fb] = await Promise.all([
      supabase.from('marketing_config').select('*').eq('restaurant_id', rest.id).maybeSingle(),
      supabase.from('customers').select('id, name, phone, birth_date, anniversary_date, referral_code').eq('restaurant_id', rest.id).limit(500),
      supabase.from('birthday_claims').select('customer_id').eq('restaurant_id', rest.id).eq('year', y),
      supabase.from('feedback').select('*, customers(name)').eq('restaurant_id', rest.id).order('created_at', { ascending: false }).limit(30),
    ])
    setMk(mkq.data || null)
    setMkF({
      referrer: String((mkq.data?.referrer_paise ?? 10000) / 100),
      referee: String((mkq.data?.referee_paise ?? 10000) / 100),
      birthday: String((mkq.data?.birthday_paise ?? 0) / 100),
    })
    setClaims(new Set((bc.data || []).map(x => x.customer_id)))
    setFbList(fb.data || [])
    const rows = (cs.data || []).map(c => ({ ...c, _b: c.birth_date ? new Date(c.birth_date + 'T00:00:00') : null, _a: c.anniversary_date ? new Date(c.anniversary_date + 'T00:00:00') : null }))
    setBdays(rows.filter(c => c._b && c._b.getMonth() === m).sort((a, b) => a._b.getDate() - b._b.getDate()))
    setAnnivs(rows.filter(c => c._a && c._a.getMonth() === m).sort((a, b) => a._a.getDate() - b._a.getDate()))
  }

  async function loadOffers() {
    const rid = rest.id
    const [w, sr, p, rw, md] = await Promise.all([
      supabase.from('wallet_schemes').select('*').eq('restaurant_id', rid).order('created_at', { ascending: false }).limit(1),
      supabase.from('stamp_rules').select('*').eq('restaurant_id', rid).order('created_at'),
      supabase.from('points_config').select('*').eq('restaurant_id', rid).maybeSingle(),
      supabase.from('rewards').select('*').eq('restaurant_id', rid).order('required_points'),
      supabase.from('modules_config').select('*').eq('restaurant_id', rid).maybeSingle(),
    ])
    if (w.data?.[0]) { setWs(w.data[0]); setWsF({ name: w.data[0].name, min: String(w.data[0].min_topup_paise / 100), bonus: String(w.data[0].bonus_pct), cap: w.data[0].bonus_cap_paise ? String(w.data[0].bonus_cap_paise / 100) : '' }) }
    setRules(sr.data || [])
    if (p.data) {
      setPc(p.data)
      const t = Object.fromEntries((p.data.tiers || []).map((x, i) => ['b' + i, String(x.min)]))
      setPcF({ per100: String(p.data.points_per_rupee * 100), active: p.data.active, ...t })
    }
    setRws(rw.data || [])
    if (md.data) { setMods(md.data); setModsF({ wallet_on: md.data.wallet_on, stamps_on: md.data.stamps_on, points_on: md.data.points_on }) }
  }
  async function loadStaff() {
    const { data } = await supabase.from('restaurant_users').select('*').eq('restaurant_id', rest.id)
    setStaff(data || [])
  }
  async function loadOutlets() {
    const { data } = await supabase.from('outlets').select('*').eq('restaurant_id', rest.id)
    setOuts(data || [])
  }

  async function saveModules() {
    const vals = { wallet_on: modsF.wallet_on, stamps_on: modsF.stamps_on, points_on: modsF.points_on }
    const { error } = await supabase.from('modules_config').upsert({ ...vals, restaurant_id: rest.id }, { onConflict: 'restaurant_id' })
    error ? setErr(errMsg(error)) : flash('Modules saved — staff and customer apps update on their next load')
    setMods({ ...vals })
  }
  async function delScheme() {
    if (!ws) return
    if (!confirm('Delete the wallet scheme? New top-ups will earn no bonus until you save a new one.')) return
    const { error } = await supabase.from('wallet_schemes').delete().eq('id', ws.id)
    error ? setErr(errMsg(error)) : flash('Wallet scheme deleted'); setWs(null); setWsF({ name: 'Wallet offer', min: '500', bonus: '10', cap: '' }); loadOffers()
  }
  async function delRule(r) {
    const [st, pr] = await Promise.all([
      supabase.from('stamp_transactions').select('id', { count: 'exact', head: true }).eq('stamp_rule_id', r.id),
      supabase.from('customer_stamp_progress').select('customer_id', { count: 'exact', head: true }).eq('stamp_rule_id', r.id),
    ])
    if ((st.count || 0) > 0 || (pr.count || 0) > 0)
      return setErr('In use — ' + (st.count || 0) + ' stamp events, ' + (pr.count || 0) + ' card(s) hold progress on it. Turn it Off instead to keep customer history intact.')
    if (!confirm('Delete rule "' + r.name + '" permanently?')) return
    const { error } = await supabase.from('stamp_rules').delete().eq('id', r.id)
    error ? setErr(errMsg(error)) : flash('Stamp rule deleted')
    loadOffers()
  }
  async function delReward(r) {
    const { count } = await supabase.from('reward_redemptions').select('id', { count: 'exact', head: true }).eq('reward_id', r.id)
    if ((count || 0) > 0)
      return setErr('Redeemed ' + count + ' time(s) — turn it Off instead to keep history intact.')
    if (!confirm('Delete reward "' + r.name + '" permanently?')) return
    const { error } = await supabase.from('rewards').delete().eq('id', r.id)
    error ? setErr(errMsg(error)) : flash('Reward deleted')
    loadOffers()
  }

  const flash = m => { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 3000) }

  async function saveScheme() {
    const vals = { name: wsF.name, min_topup_paise: toPaise(wsF.min), bonus_pct: parseFloat(wsF.bonus || 0), bonus_cap_paise: wsF.cap ? toPaise(wsF.cap) : null }
    const { error } = ws
      ? await supabase.from('wallet_schemes').update(vals).eq('id', ws.id)
      : await supabase.from('wallet_schemes').insert({ ...vals, restaurant_id: rest.id })
    error ? setErr(errMsg(error)) : flash('Wallet scheme saved'); loadOffers()
  }
  async function addRule() {
    const rv = ruleF.reward_type === 'fixed_discount' ? toPaise(ruleF.reward_value) : parseFloat(ruleF.reward_value || 0)
    const { error } = await supabase.from('stamp_rules').insert({
      restaurant_id: rest.id, name: ruleF.name, target_type: ruleF.target_type, target_value: ruleF.target_value,
      required_count: parseInt(ruleF.required_count), reward_type: ruleF.reward_type, reward_value: rv, reward_label: ruleF.reward_label,
    })
    error ? setErr(errMsg(error)) : flash('Stamp rule added')
    setRuleF({ ...ruleF, name: '', target_value: '', reward_label: '' }); loadOffers()
  }
  async function savePoints() {
    const tiers = [['Bronze', pcF.b0], ['Silver', pcF.b1], ['Gold', pcF.b2], ['Platinum', pcF.b3]].map(([name, min]) => ({ name, min: parseInt(min || 0) }))
    const vals = { points_per_rupee: parseFloat(pcF.per100 || 0) / 100, active: pcF.active, tiers }
    const { error } = pc
      ? await supabase.from('points_config').update(vals).eq('id', pc.id)
      : await supabase.from('points_config').insert({ ...vals, restaurant_id: rest.id })
    error ? setErr(errMsg(error)) : flash('Points settings saved'); loadOffers()
  }
  async function addReward() {
    if (!rwF.name.trim()) return setErr('Give the reward a name, e.g. Free ice cream.')
    const { error } = await supabase.from('rewards').insert({
      restaurant_id: rest.id, name: rwF.name.trim(), description: rwF.description.trim() || null,
      required_points: parseInt(rwF.required_points || 0), value_paise: 0, max_per_customer: parseInt(rwF.max || 0),
    })
    error ? setErr(errMsg(error)) : flash('Reward added')
    setRwF({ name: '', description: '', required_points: '500', max: '1' }); loadOffers()
  }
  const toggle = async (table, id, active) => {
    await supabase.from(table).update({ active: !active }).eq('id', id); loadOffers()
  }

  async function createStaffLogin() {
    const name = stF.name.trim(), pw = stF.pw
    const d = stF.phone.replace(/\D/g, '')
    const digits = d.length === 12 && d.startsWith('91') ? d.slice(2) : d.replace(/^0+/, '')
    const realEmail = stF.email.trim()
    if (name.length < 2) return setErr('Enter the staff name.')
    if (!realEmail && digits.length !== 10) return setErr('Enter a 10-digit phone number (or an email below).')
    if (pw.length < 8) return setErr('Starting password must be at least 8 characters.')
    const loginEmail = realEmail || staffEmail(digits)
    setErr('')
    const { data: s } = await supabase.auth.getSession()
    const adminSession = s.session
    const { error: suErr } = await supabase.auth.signUp({ email: loginEmail, password: pw })
    if (adminSession) await supabase.auth.setSession(adminSession)
    const existed = suErr && /already registered|already exists|been taken/i.test(suErr.message || '')
    if (suErr && !existed) return setErr(errMsg(suErr))
    const { error: linkErr } = await supabase.rpc('add_staff', { p_restaurant_id: rest.id, p_email: loginEmail, p_role: stF.role, p_name: name })
    if (linkErr) return setErr(errMsg(linkErr))
    flash(existed
      ? 'Linked an existing login for ' + name + ' — they sign in with their previous password.'
      : 'Login created — ' + name + ' signs in with ' + (realEmail ? 'email' : 'phone ' + digits) + ' and the password you set.')
    setStF({ email: '', role: 'staff', name: '', phone: '', pw: '' }); loadStaff()
  }
  async function addStaff() {
    const { error } = await supabase.rpc('add_staff', {
      p_restaurant_id: rest.id, p_email: stF.email, p_role: stF.role, p_name: stF.name || null,
    })
    error ? setErr(errMsg(error)) : flash('Staff added'); setStF({ email: '', role: 'staff', name: '', phone: '', pw: '' }); loadStaff()
  }
    async function resetStaffPw(s) {
    const p = prompt('Set a new starting password for ' + (s.name || 'this member') + ' (8+ characters). Share it with them — they can change it from the Staff portal.')
    if (!p) return
    if (p.length < 8) return setErr('Password must be at least 8 characters.')
    const { error } = await supabase.functions.invoke('reset-staff-password', { body: { target_user_id: s.user_id, new_password: p } })
    error ? setErr(errMsg(error)) : flash('Password reset for ' + (s.name || 'member'))
  }
  async function updStaff(id, vals) { await supabase.from('restaurant_users').update(vals).eq('id', id); loadStaff() }

  async function searchCusts(s) {
    setQ(s)
    const clean = s.replace(/[,()]/g, '')
    const query = supabase.from('customers').select('*').eq('restaurant_id', rest.id).order('created_at', { ascending: false }).limit(50)
    const { data } = clean.length >= 2
      ? await query.or(`phone.ilike.%${clean}%,name.ilike.%${clean}%`)
      : await query
    setCusts(data || [])
  }
  async function openCust(c) {
    const [pr, ords] = await Promise.all([
      supabase.from('customer_stamp_progress').select('*, stamp_rules(name, required_count)').eq('customer_id', c.id),
      supabase.from('orders').select('*').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(5),
    ])
    setSel({ ...c, prog: pr.data || [], orders: ords.data || [], birth: c.birth_date || '', anniv: c.anniversary_date || '' })
  }
  async function saveCustDates() {
    const { error } = await supabase.from('customers').update({ birth_date: sel.birth || null, anniversary_date: sel.anniv || null }).eq('id', sel.id)
    error ? setErr(errMsg(error)) : flash('Dates saved'); setSel(null)
  }
  async function adjust() {
    const { error } = await supabase.rpc('adjust_wallet', {
      p_restaurant_id: rest.id, p_customer_id: sel.id, p_amount_paise: toPaise(adjF.amount), p_reason: adjF.reason,
    })
    error ? setErr(errMsg(error)) : flash('Wallet adjusted'); setAdjF({ amount: '', reason: '' }); openCust(sel)
  }
  async function addOutlet() {
    const { error } = await supabase.from('outlets').insert({ restaurant_id: rest.id, ...outF })
    error ? setErr(errMsg(error)) : flash('Outlet added'); setOutF({ name: '', address: '', phone: '' }); loadOutlets()
  }

  async function buildCampaign() {
    const [cs, ords] = await Promise.all([
      supabase.from('customers').select('*').eq('restaurant_id', rest.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('orders').select('customer_id, created_at').eq('restaurant_id', rest.id).order('created_at', { ascending: false }).limit(1000),
    ])
    const lastVisit = {}
    ;(ords.data || []).forEach(o => { if (o.customer_id && !lastVisit[o.customer_id]) lastVisit[o.customer_id] = o.created_at })
    const now = Date.now()
    const rows = (cs.data || []).filter(c => {
      if (campSeg === 'wallet') return c.wallet_balance_paise > 0
      if (campSeg === 'idle14') { const lv = lastVisit[c.id]; return !lv || (now - new Date(lv).getTime()) > 14 * 86400000 }
      if (campSeg === 'idle30') { const lv = lastVisit[c.id]; return !lv || (now - new Date(lv).getTime()) > 30 * 86400000 }
      if (campSeg === 'points') return c.points_balance >= campPts
      return true
    })
    setCampList(rows); setCampIdx(0)
    try {
      const s = JSON.parse(localStorage.getItem('tessera_camp_' + rest.slug + '_' + campSeg) || 'null')
      setSentIds(s && s.date === new Date().toDateString() ? s.ids : [])
    } catch (e) { setSentIds([]) }
  }
  function campText(c) {
    return campMsg.replaceAll('{name}', c.name || 'friend').replaceAll('{wallet}', inr(c.wallet_balance_paise)).replaceAll('{points}', String(c.points_balance))
  }
  function waLink(c) {
    return 'https://wa.me/' + waNum(c.phone) + '?text=' + encodeURIComponent(campText(c))
  }
  function sentKey() { return 'tessera_camp_' + rest.slug + '_' + campSeg }
  function openNext(skip) {
    if (!campList || campIdx >= campList.length) return
    const c = campList[campIdx]
    if (!skip) {
      window.open(waLink(c), '_blank')
      const ids = [...sentIds, c.id]; setSentIds(ids)
      try { localStorage.setItem(sentKey(), JSON.stringify({ date: new Date().toDateString(), ids })) } catch (e) {}
    }
    setCampIdx(i => i + 1)
  }
  function copyNumbers() {
    if (!campList) return
    navigator.clipboard?.writeText(campList.map(c => waNum(c.phone)).join(', '))
    flash('All phone numbers copied — paste them while creating a WhatsApp broadcast list.')
  }

  async function saveItem() {
    const vals = { name: miF.name.trim(), category: miF.category.trim() || null, price_paise: toPaise(miF.price), cost_paise: miF.cost ? toPaise(miF.cost) : null, active: miF.active }
    if (!vals.name) return setErr('Item name is required.')
    const { error } = miF.id
      ? await supabase.from('menu_items').update(vals).eq('id', miF.id)
      : await supabase.from('menu_items').insert({ ...vals, restaurant_id: rest.id })
    error ? setErr(errMsg(error)) : flash(miF.id ? 'Item updated' : 'Item added')
    setMiF({ id: null, name: '', category: '', price: '', cost: '', active: true }); loadMenu()
  }
  function editItem(m) { setMiF({ id: m.id, name: m.name, category: m.category || '', price: String(m.price_paise / 100), cost: m.cost_paise != null ? String(m.cost_paise / 100) : '', active: m.active }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  async function delItem(m) {
    if (!confirm('Delete "' + m.name + '" from the menu? Past bills are not affected.')) return
    const { error } = await supabase.from('menu_items').delete().eq('id', m.id)
    error ? setErr(errMsg(error)) : flash('Item deleted'); loadMenu()
  }

  async function saveMk() {
    const vals = { referrer_paise: toPaise(mkF.referrer), referee_paise: toPaise(mkF.referee), birthday_paise: toPaise(mkF.birthday) }
    const { error } = mk
      ? await supabase.from('marketing_config').update(vals).eq('restaurant_id', rest.id)
      : await supabase.from('marketing_config').insert({ ...vals, restaurant_id: rest.id })
    error ? setErr(errMsg(error)) : flash('Marketing settings saved'); loadMarketing()
  }
  async function claimBday(c) {
    if (!confirm('Credit the birthday bonus to ' + (c.name || 'this customer') + '? Once per year.')) return
    const { error } = await supabase.rpc('claim_birthday', { p_restaurant_id: rest.id, p_customer_id: c.id })
    error ? setErr(errMsg(error)) : flash('Birthday credit given'); loadMarketing()
  }

  const ledgerRows = [
    ...ordersRaw.map(o => ({ at: o.created_at, what: 'Bill — ' + o.payment_method, out: outletNames[o.outlet_id] || '—', cash: o.other_paid_paise, wallet: o.wallet_paid_paise, credit: 0, by: o.created_by_name })),
    ...wtxRaw.filter(x => x.type === 'topup').map(x => ({ at: x.created_at, what: 'Wallet top-up (' + (x.payment_method || 'cash') + ')', out: outletNames[x.outlet_id] || '—', cash: x.amount_paise, wallet: 0, credit: x.bonus_paise || 0, by: x.created_by_name })),
    ...wtxRaw.filter(x => x.type === 'adjustment').map(x => ({ at: x.created_at, what: 'Adjustment — ' + (x.note || 'manual'), out: outletNames[x.outlet_id] || '—', cash: 0, wallet: 0, credit: x.amount_paise, by: x.created_by_name })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at))

  if (loadErr) return <div className="wrap"><div className="err sm">{loadErr}</div><div style={{ height: 10 }} /><button className="btn" onClick={() => window.location.reload()}>Retry</button></div>
  if (!rest) return <div className="wrap"><p className="muted">Loading…</p></div>

  const fbAvg = fbList.length ? (fbList.reduce((s, f) => s + f.stars, 0) / fbList.length).toFixed(1) : null
  const marginPct = stats && stats.revKnown > 0 ? Math.round((stats.revKnown - stats.costKnown) / stats.revKnown * 100) : null

  return <div className="wrap wide">
    <div className="spread" style={{ marginBottom: 14 }}>
      <h1>{rest.name} <span className="muted" style={{ fontSize: 15 }}>· Admin</span></h1>
      <span className="row">
        <button className="btn slim" onClick={() => { window.location.href = '/staff' }}>Staff view</button>
        <button className="btn slim" onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}>Log out</button>
      </span>
    </div>
    {msg && <div className="ok sm">{msg}</div>}
    {err && <div className="err sm">{err}</div>}

    <div className="tabs">
      {['overview', 'books', 'menu', 'marketing', 'campaigns', 'offers', 'staff', 'customers', 'outlets', 'settings'].map(t =>
        <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
    </div>

    {tab === 'overview' && <>
      {todo && <div className="card">
        <h2>Today · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</h2>
        <details className="sec" open>
          <summary>Daily recap — yesterday {inr(todo.ySales)} · {todo.yBills} bill(s) · cash to reconcile {inr(todo.yCash)}</summary>
          <p className="xs muted" style={{ marginTop: 8 }}>Daily habit: match that cash figure against the drawer before service starts.</p>
        </details>
        {todo.bdays.length > 0 && <details className="sec">
          <summary>Birthdays — next 7 days ({todo.bdays.length})</summary>
          {todo.bdays.map(c => <div key={c.id} className="spread" style={{ padding: '6px 0', borderBottom: '1px solid #F1ECE1', gap: 8 }}>
            <span className="grow"><b>{c.name || 'Customer'}</b> {c.today && <span className="chip a">TODAY</span>} <span className="muted xs">{c._o.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></span>
            <span className="row">
              <a className="btn slim" target="_blank" rel="noreferrer" href={'https://wa.me/' + waNum(c.phone) + '?text=' + encodeURIComponent('Happy birthday, ' + (c.name || 'friend') + '! Come celebrate with us at ' + rest.name + ' — a little something is waiting for you.')}>Wish</a>
              {mk && mk.birthday_paise > 0 && <button className="btn slim primary" onClick={() => creditBday(c)}>Credit {inr(mk.birthday_paise)}</button>}
            </span>
          </div>)}
        </details>}
        {todo.annivs.length > 0 && <details className="sec">
          <summary>Anniversaries — next 7 days ({todo.annivs.length})</summary>
          {todo.annivs.map(c => <div key={c.id} className="spread sm" style={{ padding: '6px 0', borderBottom: '1px solid #F1ECE1' }}>
            <span><b>{c.name || 'Customer'}</b> <span className="muted xs">{c._o.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></span>
            <a className="btn slim" target="_blank" rel="noreferrer" href={'https://wa.me/' + waNum(c.phone) + '?text=' + encodeURIComponent('Happy anniversary, ' + (c.name || 'friend') + '! Celebrate with us at ' + rest.name + ' this week?')}>Wish</a>
          </div>)}
        </details>}
        {todo.bad.length > 0 && <details className="sec">
          <summary>Low ratings to recover ({todo.bad.length})</summary>
          {todo.bad.map(f => <div key={f.created_at + (f.order_id || '')} className="spread sm" style={{ padding: '6px 0', borderBottom: '1px solid #F1ECE1' }}>
            <span><b style={{ color: '#B23A2E' }}>{'★'.repeat(f.stars)}</b> <span className="muted">{f.customers?.name || 'Guest'}</span></span>
            <span className="xs muted">{fmtDate(f.created_at)}</span>
          </div>)}
          <p className="xs muted">Reach out within 24 hours — a recovered unhappy guest becomes the most loyal one.</p>
        </details>}
        {todo.noFb.length > 0 && <details className="sec">
          <summary>Feedback not yet asked ({todo.noFb.length})</summary>
          {todo.noFb.map(o => <div key={o.id} className="spread sm" style={{ padding: '6px 0', borderBottom: '1px solid #F1ECE1' }}>
            <span><b>{o.customers?.name || 'Guest'}</b> <span className="muted num">{inr(o.total_paise)}</span> <span className="muted xs">{fmtDate(o.created_at)}</span></span>
            <a className="btn slim" target="_blank" rel="noreferrer" href={'https://wa.me/?text=' + encodeURIComponent('Thank you for visiting ' + rest.name + '! How was everything today? Rate your visit: ' + window.location.origin + '/customer?slug=' + rest.slug + '&qr=' + (todo.cMap[o.customer_id]?.qr_code || '') + '&k=' + (todo.cMap[o.customer_id]?.qr_secret || '') + '&fb=' + o.id)}>Ask</a>
          </div>)}
        </details>}
        {todo.idle > 0 && <div className="spread" style={{ marginTop: 14 }}>
          <span className="sm"><b>{todo.idle}</b> customer(s) haven't visited in 14+ days</span>
          <button className="btn slim primary" onClick={() => { setCampSeg('idle14'); setTab('campaigns') }}>Start win-back</button>
        </div>}
        {todo.bdays.length === 0 && todo.annivs.length === 0 && todo.bad.length === 0 && todo.noFb.length === 0 && todo.idle === 0
          && <p className="sm muted" style={{ marginTop: 10 }}>All clear — nothing needs your attention today.</p>}
      </div>}
      <div className="card">
        <div className="spread">
          <h2>Performance</h2>
          <select className="select" style={{ width: 'auto' }} value={range} onChange={e => setRange(parseInt(e.target.value))}>
            <option value="0">Today</option><option value="6">Last 7 days</option><option value="29">Last 30 days</option>
          </select>
        </div>
        {stats && <>
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            <div className="grow" style={{ minWidth: 120 }}><div className="xs muted">TOTAL SALES</div><div className="big num">{inr(stats.revenue)}</div></div>
            <div className="grow" style={{ minWidth: 100 }}><div className="xs muted">BILLS</div><div className="big num">{stats.bills}</div></div>
            <div className="grow" style={{ minWidth: 110 }}><div className="xs muted">AVG BILL</div><div className="big num">{inr(stats.avgBill)}</div></div>
            <div className="grow" style={{ minWidth: 110 }}><div className="xs muted">CUSTOMERS</div><div className="big num">{stats.customers}</div></div>
          </div>
          <div className="row sm" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <span className="chip">Wallet sales {inr(stats.walletSales)}</span>
            <span className="chip">Top-ups {inr(stats.topups)}</span>
            <span className="chip">Bonus given {inr(stats.bonusGiven)}</span>
            <span className="chip">Points issued {stats.points}</span>
          </div>
          <h3 style={{ marginTop: 16 }}>Daily sales</h3>
          <Bars series={stats.series} />
          <h3 style={{ marginTop: 16 }}>Payment mix</h3>
          <HBars items={[
            ...Object.entries(stats.byMethod).map(([m, v]) => ({ label: m[0].toUpperCase() + m.slice(1), value: v })),
            { label: 'Wallet', value: stats.walletSales },
          ].filter(i => i.value > 0)} />
          <div className="row" style={{ marginTop: 14 }}>
            <div className="grow"><div className="xs muted">NEW CUSTOMERS</div><div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{stats.newC}</div></div>
            <div className="grow"><div className="xs muted">RETURNING</div><div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{stats.retC}</div></div>
            <div className="grow"><div className="xs muted">REPEAT RATE</div><div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{stats.customers ? Math.round(stats.retC / stats.customers * 100) + '%' : '—'}</div></div>
          </div>
          {stats.outlets.length > 0 && <>
            <h3 style={{ marginTop: 16 }}>By outlet</h3>
            <OutletTable rows={stats.outlets} />
          </>}
          {stats.staffRows.length > 0 && <>
            <h3 style={{ marginTop: 16 }}>By staff member</h3>
            <table className="t"><thead><tr><th>Staff</th><th>Bills</th><th>Sales</th><th>Avg bill</th><th>Wallet used</th></tr></thead><tbody>
              {stats.staffRows.map(r => <tr key={r.name}>
                <td><b>{r.name}</b></td><td className="num">{r.bills}</td>
                <td className="num">{inr(r.sales)}</td><td className="num">{inr(r.avg)}</td><td className="num">{inr(r.wallet)}</td>
              </tr>)}
            </tbody></table>
          </>}
          {Object.keys(stats.itemAgg).length > 0 && <>
            <h3 style={{ marginTop: 16 }}>Top items</h3>
            <table className="t"><thead><tr><th>Item</th><th>Qty</th><th>Sales</th></tr></thead><tbody>
              {Object.entries(stats.itemAgg).sort((a, b) => b[1].amt - a[1].amt).slice(0, 8).map(([n, v]) =>
                <tr key={n}><td>{n}</td><td className="num">{v.qty}</td><td className="num">{inr(v.amt)}</td></tr>)}
            </tbody></table>
          </>}
          <div style={{ height: 12 }} />
          <button className="btn" onClick={() => downloadCsv(`orders-${rest.slug}.csv`, [
            ['Date', 'Outlet', 'Staff', 'Total ₹', 'Wallet ₹', 'Other ₹', 'Method', 'Points'],
            ...ordersRaw.map(o => [fmtDate(o.created_at), outletNames[o.outlet_id] || o.outlet_id, o.created_by_name || '', o.total_paise / 100, o.wallet_paid_paise / 100, o.other_paid_paise / 100, o.payment_method, o.points_earned]),
          ])}>Export orders CSV</button>
        </>}
      </div>
    </>}

    {tab === 'books' && <>
      <div className="card">
        <div className="spread">
          <h2>Accounts</h2>
          <select className="select" style={{ width: 'auto' }} value={range} onChange={e => setRange(parseInt(e.target.value))}>
            <option value="0">Today</option><option value="6">Last 7 days</option><option value="29">Last 30 days</option>
          </select>
        </div>
        {stats && <>
          <table className="t"><tbody>
            <tr><td><b>Sales ({stats.bills} bills)</b></td><td className="num" style={{ textAlign: 'right' }}><b>{inr(stats.revenue)}</b></td></tr>
            <tr><td className="muted">— collected at counter ({Object.entries(stats.byMethod).map(([m, v]) => m + ' ' + inr(v)).join(', ') || '—'})</td><td className="num" style={{ textAlign: 'right' }}>{inr(stats.revenue - stats.walletSales)}</td></tr>
            <tr><td className="muted">— settled from wallet</td><td className="num" style={{ textAlign: 'right' }}>{inr(stats.walletSales)}</td></tr>
            <tr><td><b>Wallet top-ups received (cash in)</b></td><td className="num" style={{ textAlign: 'right' }}><b>{inr(stats.topupCash)}</b></td></tr>
            <tr><td className="muted">— bonus credit given free</td><td className="num" style={{ textAlign: 'right' }}>−{inr(stats.bonusGiven)}</td></tr>
            {stats.revKnown > 0 && <>
              <tr><td className="muted">— food cost on priced items (from menu costs)</td><td className="num" style={{ textAlign: 'right' }}>−{inr(stats.costKnown)}</td></tr>
              <tr><td><b>Gross margin on priced items{marginPct != null ? ' (' + marginPct + '%)' : ''}</b></td><td className="num" style={{ textAlign: 'right' }}><b>{inr(stats.revKnown - stats.costKnown)}</b></td></tr>
            </>}
            <tr><td><b>Cash to reconcile (cash sales + cash top-ups)</b></td><td className="num" style={{ textAlign: 'right' }}><b>{inr(stats.cashHandover)}</b></td></tr>
            <tr><td className="muted">Wallet liability owed to customers (current)</td><td className="num" style={{ textAlign: 'right' }}>{inr(stats.walletLiability)}</td></tr>
            <tr><td className="muted">Points issued in period</td><td className="num" style={{ textAlign: 'right' }}>{stats.points}</td></tr>
            <tr><td><b>Sales − bonus credits (indicative)</b></td><td className="num" style={{ textAlign: 'right' }}><b>{inr(stats.revenue - stats.bonusGiven)}</b></td></tr>
          </tbody></table>
          <p className="xs muted" style={{ marginTop: 10 }}>
            Margin is exact only for menu items with a cost price set (custom/free items are excluded from that line — set costs under Menu to widen coverage). Bonus credits are the marketing cost of the wallet offer. Export the ledger below for your accountant.
          </p>
          <h3 style={{ marginTop: 16 }}>By outlet</h3>
          <OutletTable rows={stats.outlets} />
        </>}
      </div>
      <div className="card">
        <div className="spread"><h3>Ledger</h3><button className="btn slim" onClick={() => downloadCsv(`ledger-${rest.slug}.csv`, [
          ['Date', 'Outlet', 'Detail', 'By', 'Counter collected', 'Wallet', 'Credit/bonus out'],
          ...ledgerRows.map(r => [fmtDate(r.at), r.out, r.what, r.by || '', r.cash / 100, r.wallet / 100, r.credit / 100]),
        ])}>Export CSV</button></div>
        <table className="t"><thead><tr><th>Date</th><th>Outlet</th><th>Detail</th><th>By</th><th>Counter</th><th>Wallet</th><th>Credit out</th></tr></thead><tbody>
          {ledgerRows.slice(0, 100).map((r, i) => <tr key={i}>
            <td className="xs">{fmtDate(r.at)}</td><td className="xs">{r.out}</td><td className="sm">{r.what}</td><td className="xs">{r.by || '—'}</td>
            <td className="num">{r.cash ? inr(r.cash) : ''}</td>
            <td className="num">{r.wallet ? inr(r.wallet) : ''}</td>
            <td className="num">{r.credit ? inr(r.credit) : ''}</td>
          </tr>)}
        </tbody></table>
        {ledgerRows.length === 0 && <p className="sm muted">No entries in this period.</p>}
      </div>
    </>}

    {tab === 'menu' && <div className="card">
      <div className="spread"><h2>Menu</h2><a className="btn slim" href="/admin/import">Import from PDF</a></div>
      <p className="sm muted">One-tap billing for staff. Cost price (optional) unlocks true gross margin in Books — staff never see costs.</p>
      <div className="row"><input className="input grow" placeholder="Item name" value={miF.name} onChange={e => setMiF({ ...miF, name: e.target.value })} />
        <input className="input" style={{ width: 110 }} placeholder="Category" value={miF.category} onChange={e => setMiF({ ...miF, category: e.target.value })} /></div>
      <div className="row" style={{ marginTop: 8 }}>
        <input className="input" style={{ width: 110 }} type="number" step="0.01" placeholder="Price ₹" value={miF.price} onChange={e => setMiF({ ...miF, price: e.target.value })} />
        <input className="input" style={{ width: 110 }} type="number" step="0.01" placeholder="Cost ₹ (opt.)" value={miF.cost} onChange={e => setMiF({ ...miF, cost: e.target.value })} />
        <button className="btn slim primary" onClick={saveItem}>{miF.id ? 'Update item' : 'Add item'}</button>
        {miF.id && <button className="btn slim" onClick={() => setMiF({ id: null, name: '', category: '', price: '', cost: '', active: true })}>Cancel</button>}
      </div>
      <div style={{ height: 12 }} />
      {menu.length === 0 && <p className="sm muted">No items yet — add your top sellers first, or import a PDF above.</p>}
      {menu.map(m => <div key={m.id} className="spread sm" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1' }}>
        <span><b>{m.name}</b> <span className="muted">{m.category}</span><br />
          <span className="num muted">{inr(m.price_paise)}{m.cost_paise != null ? ' · cost ' + inr(m.cost_paise) + ' · margin ' + Math.round((m.price_paise - m.cost_paise) / m.price_paise * 100) + '%' : ''}</span></span>
        <span className="row">
          <button className={'chip ' + (m.active ? 'g' : 'r')} style={{ cursor: 'pointer' }} onClick={async () => { await supabase.from('menu_items').update({ active: !m.active }).eq('id', m.id); loadMenu() }}>{m.active ? 'Active' : 'Off'}</button>
          <button className="chip" style={{ cursor: 'pointer' }} onClick={() => resetStaffPw(s)}>Reset pw</button>
          <button className="chip" style={{ cursor: 'pointer' }} onClick={() => updStaff(s.id, { status: s.status === 'active' ? 'inactive' : 'active' })}>{s.status === 'active' ? 'Deactivate' : 'Activate'}</button>          <button className="chip r" style={{ cursor: 'pointer' }} onClick={() => delItem(m)}>Del</button>
        </span>
      </div>)}
    </div>}

    {tab === 'marketing' && <>
      <div className="card">
        <h2>Rewards & occasions</h2>
        <p className="sm muted">Referral bonuses credit both wallets the moment staff enters the friend's code. Birthday credit is once per customer per year.</p>
        <div className="row">
          <div className="grow"><label className="label">Referrer gets ₹</label><input className="input" type="number" value={mkF.referrer} onChange={e => setMkF({ ...mkF, referrer: e.target.value })} /></div>
          <div className="grow"><label className="label">New friend gets ₹</label><input className="input" type="number" value={mkF.referee} onChange={e => setMkF({ ...mkF, referee: e.target.value })} /></div>
          <div className="grow"><label className="label">Birthday credit ₹ (0 = off)</label><input className="input" type="number" value={mkF.birthday} onChange={e => setMkF({ ...mkF, birthday: e.target.value })} /></div>
        </div>
        <div style={{ height: 12 }} /><button className="btn primary" onClick={saveMk}>Save settings</button>
      </div>
      <div className="card">
        <h3>Birthdays this month ({bdays.length})</h3>
        {bdays.length === 0 && <p className="sm muted">No birthdays this month.</p>}
        {bdays.map(c => <div key={c.id} className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1', gap: 8 }}>
          <span className="grow"><b>{c.name || 'Customer'}</b> <span className="muted num sm">{c.phone}</span>
            <div className="xs muted">{c._b.getDate() + ' ' + c._b.toLocaleString('en', { month: 'long' })}{claims.has(c.id) ? ' · credit given this year' : ''}</div></span>
          <span className="row">
            {mk && mk.birthday_paise > 0 && !claims.has(c.id) && <button className="btn slim primary" onClick={() => claimBday(c)}>Credit {inr(mk.birthday_paise)}</button>}
            <a className="btn slim" target="_blank" rel="noreferrer" href={'https://wa.me/' + waNum(c.phone) + '?text=' + encodeURIComponent('Happy birthday, ' + (c.name || 'friend') + '! Come celebrate with us at ' + rest.name + ' — a little something is waiting for you.')}>Wish</a>
          </span>
        </div>)}
        <h3 style={{ marginTop: 14 }}>Anniversaries this month ({annivs.length})</h3>
        {annivs.map(c => <div key={c.id} className="spread sm" style={{ padding: '6px 0', borderBottom: '1px solid #F1ECE1' }}>
          <span><b>{c.name || 'Customer'}</b> <span className="muted num">{c.phone}</span></span>
          <span className="muted xs">{c._a.getDate() + ' ' + c._a.toLocaleString('en', { month: 'long' })}</span>
        </div>)}
        {annivs.length === 0 && <p className="sm muted">None recorded.</p>}
      </div>
      <div className="card">
        <div className="spread"><h3>Guest feedback</h3>{fbAvg && <span className="chip a">avg {fbAvg} / 5 ({fbList.length})</span>}</div>
        {fbList.length === 0 && <p className="sm muted">No feedback yet — staff can request it after each bill; low ratings also surface on the Today card.</p>}
        {fbList.map(f => <div key={f.id} className="spread sm" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1' }}>
          <span><b className="num" style={{ color: '#8F6A12' }}>{'★'.repeat(f.stars)}{'☆'.repeat(5 - f.stars)}</b> <span className="muted">{f.customers?.name || ''}</span>{f.comment && <div className="xs muted">"{f.comment}"</div>}</span>
          <span className="muted xs">{fmtDate(f.created_at)}</span>
        </div>)}
        {fbList.filter(f => f.stars >= 4 && f.comment).length > 0 && <div style={{ height: 10 }} />}
        {fbList.filter(f => f.stars >= 4 && f.comment).length > 0 && <button className="btn" onClick={() => downloadCsv(`testimonials-${rest.slug}.csv`, [
          ['Date', 'Stars', 'Name', 'Comment'],
          ...fbList.filter(f => f.stars >= 4 && f.comment).map(f => [fmtDate(f.created_at), f.stars, f.customers?.name || '', f.comment]),
        ])}>Export testimonials (4-5 star comments)</button>}
      </div>
    </>}

    {tab === 'campaigns' && <div className="card">
      <h2>Campaigns — bring customers back</h2>
      <p className="sm muted">Pick a segment, write one message with placeholders {'{name}'} {'{wallet}'} {'{points}'}, then send.</p>
      <div className="row">
        <select className="select" style={{ width: 210 }} value={campSeg} onChange={e => setCampSeg(e.target.value)}>
          <option value="all">All customers</option>
          <option value="wallet">Has wallet balance</option>
          <option value="idle14">No visit in 14+ days</option>
          <option value="idle30">No visit in 30+ days</option>
          <option value="points">Points earned</option>
        </select>
        {campSeg === 'points' && <input className="input" style={{ width: 110 }} type="number" value={campPts} onChange={e => setCampPts(parseInt(e.target.value || 0))} />}
      </div>
      <label className="label">Message</label>
      <textarea className="input" rows={3} value={campMsg} onChange={e => setCampMsg(e.target.value)} />
      {campList && <>
        <p className="sm" style={{ marginTop: 10 }}><b>{campList.length}</b> in this segment · <b>{sentIds.length}</b> opened today</p>
        {campList.length > 0 && <div className="card" style={{ background: '#F8F4EC', marginBottom: 12 }}>
          <h3>Assisted sending {campIdx < campList.length ? '— next: ' + (campList[campIdx].name || campList[campIdx].phone) + ' (' + (campIdx + 1) + '/' + campList.length + ')' : '— done'}</h3>
          <div className="bar" style={{ margin: '8px 0' }}><div style={{ width: (sentIds.length / campList.length * 100) + '%' }} /></div>
          <div className="row">
            <button className="btn primary slim grow" disabled={campIdx >= campList.length} onClick={() => openNext(false)}>Open in WhatsApp</button>
            <button className="btn slim" disabled={campIdx >= campList.length} onClick={() => openNext(true)}>Skip</button>
            <button className="btn slim" onClick={() => { setCampIdx(0); setSentIds([]); try { localStorage.removeItem(sentKey()) } catch (e) {} }}>Reset</button>
          </div>
          <div style={{ height: 8 }} />
          <button className="btn slim" onClick={copyNumbers}>Copy all phone numbers</button>
          <p className="xs muted" style={{ marginTop: 8 }}>Tip: keep under ~25 WhatsApp sends per day from one number.</p>
        </div>}
        {campList.map(c => <div key={c.id} className="spread" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1', gap: 10 }}>
          <span className="grow">
            <b>{c.name || 'Customer'}</b> <span className="muted num sm">{c.phone}</span>
            {sentIds.includes(c.id) && <span className="chip g" style={{ marginLeft: 6 }}>opened</span>}
            <div className="xs muted">{campText(c)}</div>
          </span>
          <a className="btn slim primary" href={waLink(c)} target="_blank" rel="noreferrer">Send</a>
        </div>)}
        {campList.length === 0 && <p className="sm muted">No customers match this segment.</p>}
        <div style={{ height: 10 }} />
        <button className="btn" onClick={() => downloadCsv(`campaign-${campSeg}.csv`, [
          ['Name', 'Phone', 'Message', 'WhatsApp link'],
          ...campList.map(c => [c.name || '', c.phone, campText(c), waLink(c)]),
        ])}>Export segment (CSV with links)</button>
      </>}
    </div>}

    {tab === 'offers' && <div className="card">
      <S title="Modules — show or hide wallet, stamps, points" open>
        <p className="xs muted">Switch a module off and it disappears from the staff and customer apps (history is kept).</p>
        <label className="spread sm" style={{ padding: '6px 0', cursor: 'pointer' }}><span><b>Wallet & top-ups</b></span><input type="checkbox" checked={modsF.wallet_on} onChange={e => setModsF({ ...modsF, wallet_on: e.target.checked })} /></label>
        <label className="spread sm" style={{ padding: '6px 0', cursor: 'pointer' }}><span><b>Stamp cards</b></span><input type="checkbox" checked={modsF.stamps_on} onChange={e => setModsF({ ...modsF, stamps_on: e.target.checked })} /></label>
        <label className="spread sm" style={{ padding: '6px 0', cursor: 'pointer' }}><span><b>Points & tiers</b></span><input type="checkbox" checked={modsF.points_on} onChange={e => setModsF({ ...modsF, points_on: e.target.checked })} /></label>
        <div style={{ height: 10 }} /><button className="btn primary" onClick={saveModules}>Save modules</button>
      </S>
      <S title="Wallet scheme" open>
        <div className="row"><div className="grow"><label className="label">Name</label><input className="input" value={wsF.name} onChange={e => setWsF({ ...wsF, name: e.target.value })} /></div>
          <div style={{ width: 110 }}><label className="label">Min top-up ₹</label><input className="input" type="number" value={wsF.min} onChange={e => setWsF({ ...wsF, min: e.target.value })} /></div></div>
        <div className="row"><div className="grow"><label className="label">Bonus %</label><input className="input" type="number" value={wsF.bonus} onChange={e => setWsF({ ...wsF, bonus: e.target.value })} /></div>
          <div className="grow"><label className="label">Bonus cap ₹ (blank = none)</label><input className="input" type="number" value={wsF.cap} onChange={e => setWsF({ ...wsF, cap: e.target.value })} /></div></div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary grow" onClick={saveScheme}>Save wallet scheme</button>
          {ws && <button className="btn danger" style={{ width: 'auto' }} onClick={delScheme}>Delete</button>}
        </div>
      </S>
      <S title={`Stamp rules (${rules.length})`} open>
        {rules.map(r => <div key={r.id} className="spread sm" style={{ padding: '6px 0' }}>
          <span><b>{r.name}</b> — {r.target_value} ×{r.required_count} → {r.reward_type === 'free_item' ? r.reward_label : (r.reward_type === 'percent_discount' ? r.reward_value + '% off' : inr(r.reward_value) + ' off')}</span>
          <span className="row">
            <button className={'chip ' + (r.active ? 'g' : 'r')} style={{ cursor: 'pointer' }} onClick={() => toggle('stamp_rules', r.id, r.active)}>{r.active ? 'Active' : 'Off'}</button>
            <button className="chip r" style={{ cursor: 'pointer' }} onClick={() => delRule(r)}>Del</button>
          </span>
        </div>)}
        <div className="row"><input className="input grow" placeholder="Rule name e.g. Coffee card" value={ruleF.name} onChange={e => setRuleF({ ...ruleF, name: e.target.value })} />
          <select className="select" style={{ width: 120 }} value={ruleF.target_type} onChange={e => setRuleF({ ...ruleF, target_type: e.target.value })}><option value="item">Item</option><option value="category">Category</option></select>
          <input className="input" style={{ width: 110 }} placeholder="Target" value={ruleF.target_value} onChange={e => setRuleF({ ...ruleF, target_value: e.target.value })} /></div>
        <div className="row" style={{ marginTop: 8 }}>
          <input className="input" style={{ width: 80 }} type="number" placeholder="Buy" value={ruleF.required_count} onChange={e => setRuleF({ ...ruleF, required_count: e.target.value })} />
          <select className="select" style={{ width: 150 }} value={ruleF.reward_type} onChange={e => setRuleF({ ...ruleF, reward_type: e.target.value })}>
            <option value="free_item">Free item</option><option value="percent_discount">% discount</option><option value="fixed_discount">₹ discount</option></select>
          <input className="input grow" placeholder="Reward value (1 / % / ₹)" value={ruleF.reward_value} onChange={e => setRuleF({ ...ruleF, reward_value: e.target.value })} />
          <input className="input grow" placeholder="Label e.g. 1 free coffee" value={ruleF.reward_label} onChange={e => setRuleF({ ...ruleF, reward_label: e.target.value })} /></div>
        <div style={{ height: 12 }} /><button className="btn primary" onClick={addRule}>Add stamp rule</button>
      </S>
      <S title="Points & tiers">
        <p className="xs muted">Customers earn points on every bill. Rewards below unlock at fixed point levels; tiers are status badges based on lifetime points.</p>
        <div className="grow"><label className="label">Points earned per ₹100 spent</label><input className="input" type="number" step="0.5" value={pcF.per100} onChange={e => setPcF({ ...pcF, per100: e.target.value })} /></div>
        <div className="row" style={{ marginTop: 8 }}>
          {['b0', 'b1', 'b2', 'b3'].map((k, i) => <div key={k} className="grow"><label className="label">{['Bronze from', 'Silver from', 'Gold from', 'Platinum from'][i]} (pts)</label><input className="input" type="number" value={pcF[k]} onChange={e => setPcF({ ...pcF, [k]: e.target.value })} /></div>)}
        </div>
        <div style={{ height: 12 }} /><button className="btn primary" onClick={savePoints}>Save points settings</button>
      </S>
      <S title={`Points rewards (${rws.length})`} open>
        <p className="xs muted">Each reward unlocks when a customer's points reach the threshold. Staff give it free at the counter; points are deducted automatically. Shown on the customer's rewards page.</p>
        {rws.map(r => <div key={r.id} className="spread sm" style={{ padding: '6px 0' }}>
          <span><b>{r.name}</b> — at <b className="num">{r.required_points}</b> points{r.max_per_customer ? ` · max ${r.max_per_customer}× per customer` : ' · unlimited'}{r.description ? <div className="xs muted">{r.description}</div> : null}</span>
          <span className="row">
            <button className={'chip ' + (r.active ? 'g' : 'r')} style={{ cursor: 'pointer' }} onClick={() => toggle('rewards', r.id, r.active)}>{r.active ? 'Active' : 'Off'}</button>
            <button className="chip r" style={{ cursor: 'pointer' }} onClick={() => delReward(r)}>Del</button>
          </span>
        </div>)}
        <label className="label">Reward name (e.g. Free ice cream)</label>
        <input className="input" value={rwF.name} onChange={e => setRwF({ ...rwF, name: e.target.value })} />
        <label className="label">Description shown to customers (optional)</label>
        <input className="input" value={rwF.description} onChange={e => setRwF({ ...rwF, description: e.target.value })} placeholder="e.g. Any flavour, one scoop" />
        <div className="row" style={{ marginTop: 4 }}>
          <div className="grow"><label className="label">Points needed (e.g. 500)</label><input className="input" type="number" value={rwF.required_points} onChange={e => setRwF({ ...rwF, required_points: e.target.value })} /></div>
          <div className="grow"><label className="label">Max times one customer can claim (0 = unlimited)</label><input className="input" type="number" value={rwF.max} onChange={e => setRwF({ ...rwF, max: e.target.value })} /></div>
        </div>
        <div style={{ height: 12 }} /><button className="btn primary" onClick={addReward}>Add reward</button>
      </S>
    </div>}

    {tab === 'staff' && <div className="card">
      <h2>Staff & roles</h2>
      {staff.map(s => <div key={s.id} className="spread sm" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1' }}>
        <span><b>{s.name || s.role}</b> <span className="muted">({s.role})</span> {s.status !== 'active' && <span className="chip r">inactive</span>}</span>
        <span className="row">
          <select className="select" style={{ width: 120, padding: '6px 8px' }} value={s.role} onChange={e => updStaff(s.id, { role: e.target.value })}>
            <option value="owner">owner</option><option value="manager">manager</option><option value="staff">staff</option></select>
          <button className="chip" style={{ cursor: 'pointer' }} onClick={() => updStaff(s.id, { status: s.status === 'active' ? 'inactive' : 'active' })}>{s.status === 'active' ? 'Deactivate' : 'Activate'}</button>
        </span>
      </div>)}
      <h3 style={{ marginTop: 14 }}>Add a team member</h3>
      <p className="xs muted">Creates their login instantly — nothing to sign up on their side. They sign in with their phone number and the password you set, and can change it anytime from the Staff portal.</p>
      <div className="row" style={{ marginTop: 8 }}>
        <input className="input grow" placeholder="Full name" value={stF.name} onChange={e => setStF({ ...stF, name: e.target.value })} />
        <select className="select" style={{ width: 120 }} value={stF.role} onChange={e => setStF({ ...stF, role: e.target.value })}>
          <option value="staff">staff</option><option value="manager">manager</option><option value="owner">owner</option></select>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <input className="input grow" type="tel" placeholder="Phone (10 digits) — their login" value={stF.phone} onChange={e => setStF({ ...stF, phone: e.target.value })} />
        <input className="input" style={{ width: 180 }} placeholder="Starting password (8+ chars)" value={stF.pw} onChange={e => setStF({ ...stF, pw: e.target.value })} />
      </div>
      <div style={{ height: 10 }} />
      <button className="btn primary" onClick={createStaffLogin}>Create login &amp; add to team</button>
      <details className="sec" style={{ marginTop: 10 }}>
        <summary className="sm muted">They already created their own login? Link by email</summary>
        <div className="row" style={{ marginTop: 8 }}>
          <input className="input grow" placeholder="their@email.com" value={stF.email} onChange={e => setStF({ ...stF, email: e.target.value })} />
          <button className="btn slim" onClick={addStaff}>Link</button>
        </div>
      </details>
    </div>}

    {tab === 'customers' && <div className="card">
      <h2>Customers {custs.length > 0 && <span className="muted sm">({custs.length}{q.length < 2 ? ' most recent' : ' found'})</span>}</h2>
      <input className="input" placeholder="Search phone or name" value={q} onChange={e => searchCusts(e.target.value)} />
      {custs.map(c => <div key={c.id} className="spread sm" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1', cursor: 'pointer' }} onClick={() => openCust(c)}>
        <span><b>{c.name || 'Customer'}</b> <span className="muted num">{c.phone}</span></span>
        <span className="row"><span className="chip">{inr(c.wallet_balance_paise)}</span><span className="chip a">{c.points_balance} pts</span></span>
      </div>)}
      {custs.length === 0 && <p className="sm muted">No customers yet — they are created at the counter in the Staff portal.</p>}
      {sel && <div className="overlay" onClick={() => setSel(null)}>
        <div className="modal" style={{ textAlign: 'left' }} onClick={e => e.stopPropagation()}>
          <h2>{sel.name || 'Customer'}</h2>
          <div className="row" style={{ margin: '10px 0' }}>
            <div className="grow"><div className="xs muted">WALLET</div><div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{inr(sel.wallet_balance_paise)}</div></div>
            <div className="grow"><div className="xs muted">POINTS</div><div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{sel.points_balance} <span className="chip">{tierFor(sel.lifetime_points, (pc?.tiers) || [])?.name || 'Bronze'}</span></div></div>
          </div>
          {sel.referral_code && <p className="sm">Referral code: <b style={{ letterSpacing: 2 }}>{sel.referral_code}</b></p>}
          {sel.prog.map(p => <div key={p.stamp_rule_id} className="sm">{p.stamp_rules.name}: <b className="num">{p.stamps_earned}</b> stamps, {(p.rewards_redeemed || 0)} redeemed</div>)}
          <div className="row" style={{ marginTop: 10 }}>
            <div className="grow"><label className="label">Birthday</label><input className="input" type="date" value={sel.birth} onChange={e => setSel({ ...sel, birth: e.target.value })} /></div>
            <div className="grow"><label className="label">Anniversary</label><input className="input" type="date" value={sel.anniv} onChange={e => setSel({ ...sel, anniv: e.target.value })} /></div>
          </div>
          <div style={{ height: 8 }} />
          <button className="btn slim" onClick={saveCustDates}>Save dates</button>
          <h3 style={{ marginTop: 12 }}>Recent bills</h3>
          {sel.orders.map(o => <div key={o.id} className="spread sm" style={{ padding: '4px 0' }}><span className="muted">{fmtDate(o.created_at)}{o.created_by_name ? ' · ' + o.created_by_name : ''}</span><b className="num">{inr(o.total_paise)}</b></div>)}
          <h3 style={{ marginTop: 14 }}>Adjust wallet (audited)</h3>
          <div className="row"><input className="input grow" type="number" step="0.01" placeholder="Amount ₹ (+/-)" value={adjF.amount} onChange={e => setAdjF({ ...adjF, amount: e.target.value })} /></div>
          <input className="input" style={{ marginTop: 8 }} placeholder="Reason (required)" value={adjF.reason} onChange={e => setAdjF({ ...adjF, reason: e.target.value })} />
          <div style={{ height: 10 }} />
          <button className="btn primary" onClick={adjust}>Apply adjustment</button>
          <div style={{ height: 8 }} />
          <button className="btn" onClick={() => setLink(customerLink(rest.slug, sel.qr_code, sel.qr_secret))}>Show customer QR / link</button>
          {link && <div style={{ textAlign: 'center', padding: 12 }}>
            <QRCodeSVG value={link} size={180} /><p className="xs muted" style={{ wordBreak: 'break-all' }}>{link}</p></div>}
          <div style={{ height: 8 }} />
          <button className="btn danger" onClick={() => setSel(null)}>Close</button>
        </div>
      </div>}
    </div>}

    {tab === 'outlets' && <div className="card">
      <h2>Outlets</h2>
      {outs.map(o => <div key={o.id} className="spread sm" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1' }}>
        <span><b>{o.name}</b> <span className="muted">{o.address}</span></span><span className="chip g">{o.status}</span>
      </div>)}
      <h3 style={{ marginTop: 14 }}>Add outlet</h3>
      <input className="input" style={{ marginTop: 8 }} placeholder="Outlet name" value={outF.name} onChange={e => setOutF({ ...outF, name: e.target.value })} />
      <input className="input" style={{ marginTop: 8 }} placeholder="Address" value={outF.address} onChange={e => setOutF({ ...outF, address: e.target.value })} />
      <input className="input" style={{ marginTop: 8 }} placeholder="Phone" value={outF.phone} onChange={e => setOutF({ ...outF, phone: e.target.value })} />
      <div style={{ height: 12 }} /><button className="btn primary" onClick={addOutlet}>Add outlet</button>
    </div>}

    {tab === 'settings' && <div className="card">
      <h2>Restaurant branding</h2>
      <p className="sm muted">Shown on the customer's loyalty page. Use a square logo (PNG/JPG) and a wide cover photo. Max 4 MB each.</p>
      <div className="row" style={{ alignItems: 'flex-start', marginTop: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 84, height: 84, borderRadius: '50%', border: '3px solid #E8E1D3', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            {brandF.logo ? <img src={brandF.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="xs muted">No logo</span>}
          </div>
          <label className="btn slim" style={{ marginTop: 8, width: 'auto', cursor: 'pointer' }}>{brandBusy === 'logo' ? 'Uploading…' : 'Upload logo'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadBrand(e, 'logo')} />
          </label>
        </div>
        <div className="grow">
          <div style={{ height: 96, borderRadius: 12, border: '1px solid #E8E1D3', background: brandF.cover ? 'url(' + brandF.cover + ') center/cover' : '#F1ECE1' }} />
          <label className="btn slim" style={{ marginTop: 8, width: 'auto', cursor: 'pointer' }}>{brandBusy === 'cover' ? 'Uploading…' : 'Upload cover photo'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadBrand(e, 'cover')} />
          </label>
        </div>
      </div>
      <label className="label">Rewards terms & conditions (shown under the rewards list)</label>
      <textarea className="input" rows={4} value={brandF.terms} onChange={e => setBrandF({ ...brandF, terms: e.target.value })} placeholder={'e.g. Rewards are redeemable in-store only.\nOne reward per visit.\nManagement reserves the right to change offers.'} />
      <div style={{ height: 10 }} />
      <button className="btn primary" onClick={saveTerms}>Save terms</button>
    </div>}
  </div>
}
