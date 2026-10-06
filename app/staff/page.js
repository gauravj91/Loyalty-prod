'use client'
import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { inr, toPaise, fmtDate, tierFor, errMsg, customerLink } from '../../lib/helpers'

export default function Staff() {
  const [phase, setPhase] = useState('loading')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const [rest, setRest] = useState(null); const [me, setMe] = useState(null)
  const [outlets, setOutlets] = useState([]); const [outletId, setOutletId] = useState('')
  const [scheme, setScheme] = useState(null); const [mk, setMk] = useState(null)
  const [mods, setMods] = useState({ wallet_on: true, stamps_on: true, points_on: true })
  const [menu, setMenu] = useState([])
  const [cust, setCust] = useState(null)
  const [prog, setProg] = useState([]); const [cfg, setCfg] = useState(null)
  const [rewards, setRewards] = useState([]); const [redCount, setRedCount] = useState({})
  const [recent, setRecent] = useState([])
  const [results, setResults] = useState(null)
  const [orders, setOrders] = useState([]); const [wtx, setWtx] = useState([]); const [stx, setStx] = useState([])
  const [rules, setRules] = useState([]); const [stampQty, setStampQty] = useState({})
  const [items, setItems] = useState([])
  const [f, setF] = useState({ name: '', category: '', qty: '1', price: '' })
  const [walletAmt, setWalletAmt] = useState(''); const [payMethod, setPayMethod] = useState('cash')
  const [rewardSel, setRewardSel] = useState(null); const [stampSel, setStampSel] = useState(null)
  const [result, setResult] = useState(null)
  const [topAmt, setTopAmt] = useState(''); const [topMethod, setTopMethod] = useState('cash')
  const [tab, setTab] = useState('bill')
  const [phone, setPhone] = useState('')
  const [nc, setNc] = useState({ name: '', phone: '', birth: '', anniv: '', ref: '' })
  const [link, setLink] = useState(null)
  const idemRef = useRef(null)

  useEffect(() => { (async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    const { data: ru } = await supabase.from('restaurant_users')
      .select('*, restaurants(name, slug)').eq('user_id', session.user.id).limit(1)
    if (!ru?.length) { setErr('This account is not linked to a restaurant.'); return setPhase('error') }
    setMe(ru[0]); setRest(ru[0].restaurants)
    const rid = ru[0].restaurant_id
    const [outs, sch, sr, mn, mkq, mdq] = await Promise.all([
      supabase.from('outlets').select('*').eq('restaurant_id', rid).eq('status', 'active'),
      supabase.from('wallet_schemes').select('*').eq('restaurant_id', rid).eq('active', true).order('created_at', { ascending: false }).limit(1),
      supabase.from('stamp_rules').select('*').eq('restaurant_id', rid).eq('active', true).order('created_at'),
      supabase.from('menu_items').select('*').eq('restaurant_id', rid).eq('active', true).order('category').order('name'),
      supabase.from('marketing_config').select('*').eq('restaurant_id', rid).maybeSingle(),
      supabase.from('modules_config').select('*').eq('restaurant_id', rid).maybeSingle(),
    ])
    setOutlets(outs.data || []); if (outs.data?.length) setOutletId(outs.data[0].id)
    setScheme(sch.data?.[0] || null)
    setRules(sr.data || [])
    setMenu(mn.data || [])
    setMk(mkq.data || null)
    if (mdq.data) setMods(mdq.data)
    setPhase('ready')
  })() }, [])

  async function loadCustomer(c) {
    setCust(c); setResult(null); setItems([]); setWalletAmt('')
    setRewardSel(null); setStampSel(null); setTab('bill'); setErr(''); setResults(null)
    const rid = c.restaurant_id
    const [cf2, pr, cf, rw, rd, ro, wt, st] = await Promise.all([
      supabase.from('customers').select('*').eq('id', c.id).single(),
      supabase.from('customer_stamp_progress').select('*, stamp_rules(name, required_count, reward_type, reward_value, reward_label, target_value)').eq('customer_id', c.id),
      supabase.from('points_config').select('*').eq('restaurant_id', rid).maybeSingle(),
      supabase.from('rewards').select('*').eq('restaurant_id', rid).eq('active', true),
      supabase.from('reward_redemptions').select('reward_id').eq('customer_id', c.id),
      supabase.from('orders').select('*').eq('restaurant_id', rid).eq('customer_id', c.id).order('created_at', { ascending: false }).limit(15),
      supabase.from('wallet_transactions').select('*').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('stamp_transactions').select('*, stamp_rules(name)').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(10),
    ])
    if (cf2.data) setCust(cf2.data)
    setProg(pr.data || []); setCfg(cf.data); setRewards(rw.data || [])
    setOrders(ro.data || []); setWtx(wt.data || []); setStx(st.data || [])
    const counts = {}; (rd.data || []).forEach(x => counts[x.reward_id] = (counts[x.reward_id] || 0) + 1)
    setRedCount(counts)
    const seen = {}; const list = []
    ;(ro.data || []).forEach(o => (o.items || []).forEach(it => {
      if (!it.free && it.unit_price_paise > 0 && !seen[it.name]) { seen[it.name] = 1; list.push(it) }
    }))
    setRecent(list.slice(0, 8))
  }

  async function findCustomer({ term }) {
    setBusy(true); setErr(''); setResults(null)
    const clean = (term || '').replace(/[,()]/g, '')
    const { data, error } = await supabase.from('customers').select('*')
      .eq('restaurant_id', me.restaurant_id)
      .or(`phone.ilike.%${clean}%,name.ilike.%${clean}%`).limit(6)
    setBusy(false)
    if (error) return setErr(errMsg(error))
    if (!data || data.length === 0)
      return setErr('No customer found. Use "Add customer" to create one.')
    if (data.length > 1) return setResults(data)
    loadCustomer(data[0])
  }

  function addMenu(m) {
    setItems(xs => {
      const i = xs.findIndex(x => x.name === m.name && !x.free)
      if (i >= 0) { const copy = [...xs]; copy[i] = { ...copy[i], qty: copy[i].qty + 1 }; return copy }
      return [...xs, { name: m.name, category: m.category || '', qty: 1, unit_price_paise: m.price_paise, cost_paise: m.cost_paise ?? null, free: false }]
    })
    setErr('')
  }
  function addItem() {
    const name = f.name.trim()
    const qty = parseInt(f.qty || '1')
    const price = toPaise(f.price)
    if (!name || qty < 1 || price < 0) return setErr('Item needs a name, quantity and price.')
    setItems(xs => {
      const i = xs.findIndex(x => x.name === name && !x.free)
      if (i >= 0) { const copy = [...xs]; copy[i] = { ...copy[i], qty: copy[i].qty + qty }; return copy }
      return [...xs, { name, category: f.category.trim(), qty, unit_price_paise: price, cost_paise: null, free: false }]
    })
    setF({ name: '', category: '', qty: '1', price: '' }); setErr('')
  }
  const subtotal = () => items.reduce((s, i) => s + i.qty * i.unit_price_paise, 0)
  function estDiscount() {
    let d = 0
    if (mods.points_on && rewardSel) { const r = rewards.find(x => x.id === rewardSel); if (r) d += Math.min(r.value_paise, subtotal()) }
    if (mods.stamps_on && stampSel) {
      const p = prog.find(x => x.stamp_rule_id === stampSel)
      if (p && p.stamp_rules.reward_type === 'percent_discount') d += Math.floor(subtotal() * p.stamp_rules.reward_value / 100)
      if (p && p.stamp_rules.reward_type === 'fixed_discount') d += Math.min(p.stamp_rules.reward_value, subtotal())
    }
    return Math.min(d, subtotal())
  }
  const estTotal = () => Math.max(subtotal() - estDiscount(), 0)
  const maxWallet = () => mods.wallet_on ? Math.min(cust?.wallet_balance_paise || 0, estTotal()) : 0
  const unlocked = () => mods.stamps_on ? prog.filter(p => Math.floor(p.stamps_earned / p.stamp_rules.required_count) - (p.rewards_redeemed || 0) > 0) : []
  const affordable = () => mods.points_on ? rewards.filter(r => cust && cust.points_balance >= r.required_points && (r.max_per_customer === 0 || (redCount[r.id] || 0) < r.max_per_customer)) : []
  const isBday = (() => {
    if (!cust?.birth_date) return false
    const d = new Date(cust.birth_date + 'T00:00:00'); const t = new Date()
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth()
  })()
  const topBonus = scheme && toPaise(topAmt) > 0 ? Math.floor(toPaise(topAmt) * scheme.bonus_pct / 100) : 0
  const topCredit = toPaise(topAmt) + topBonus

  function applyStamp(p) {
    const rule = p.stamp_rules
    if (rule.reward_type === 'free_item')
      setItems(xs => [...xs, { name: rule.reward_label || ('Free ' + rule.target_value), category: rule.target_value, qty: 1, unit_price_paise: 0, cost_paise: null, free: true }])
    setStampSel(p.stamp_rule_id); setRewardSel(null)
  }

  async function submitOrder() {
    if (!outletId) return setErr('No outlet set. Ask the admin to add one under Admin, Outlets, then reload this page.')
    if (!items.length) return setErr('Add at least one item.')
    if (toPaise(walletAmt) > maxWallet()) return setErr('Wallet amount exceeds what is available / payable.')
    setBusy(true); setErr('')
    if (!idemRef.current) idemRef.current = crypto.randomUUID()
    const { data, error } = await supabase.rpc('process_order', {
      p_restaurant_id: me.restaurant_id, p_outlet_id: outletId,
      p_customer_id: cust?.id || null,
      p_items: items, p_wallet_paid_paise: toPaise(walletAmt),
      p_payment_method: payMethod,
      p_redeem_reward_id: mods.points_on ? rewardSel : null,
      p_redeem_stamp_rule_id: mods.stamps_on ? stampSel : null,
      p_idempotency_key: idemRef.current,
    })
    setBusy(false)
    if (error) { idemRef.current = null; return setErr(errMsg(error)) }
    setResult({ kind: 'order', ...data }); idemRef.current = null
    setItems([]); setWalletAmt(''); setRewardSel(null); setStampSel(null)
    if (cust) loadCustomer(cust)
  }

  function feedbackUrl(orderId) {
    return window.location.origin + '/customer?slug=' + rest.slug +
      '&qr=' + encodeURIComponent(cust.qr_code) + '&k=' + cust.qr_secret + '&fb=' + orderId
  }
  function sendFeedbackReq() {
    const txt = 'Thank you for visiting ' + (rest.name || 'us') + '! How was everything today? Rate your visit here: ' + feedbackUrl(result.order_id)
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank')
  }

  async function doTopup() {
    if (!outletId) return setErr('No outlet set. Ask the admin to add one under Admin, Outlets, then reload this page.')
    const amt = toPaise(topAmt)
    if (amt <= 0) return setErr('Enter an amount.')
    if (!cust) return setErr('Select a customer first.')
    if (scheme && amt < scheme.min_topup_paise) return setErr('Minimum top-up is ' + inr(scheme.min_topup_paise))
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('topup_wallet', {
      p_restaurant_id: me.restaurant_id, p_outlet_id: outletId, p_customer_id: cust.id,
      p_amount_paise: amt, p_payment_method: topMethod, p_idempotency_key: crypto.randomUUID(),
    })
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setResult({ kind: 'topup', ...data }); setTopAmt('')
    loadCustomer(cust)
  }

  async function addStamps(ruleId, qty) {
    const n = parseInt(qty)
    if (!n || n < 1) return setErr('Enter how many stamps to add.')
    if (n > 50) return setErr('Maximum 50 stamps per entry.')
    if (!outletId) return setErr('No outlet set. Ask the admin to add one, then reload this page.')
    if (n > 1 && !confirm('Manually add ' + n + ' stamps? This is logged in History with your name.')) return
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('add_stamps', {
      p_restaurant_id: me.restaurant_id, p_outlet_id: outletId, p_customer_id: cust.id,
      p_stamp_rule_id: ruleId, p_count: n,
    })
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setResult({ kind: 'stamps', total: data.total, unlocked: data.unlocked })
    setStampQty({})
    loadCustomer(cust)
  }

  async function claimBday() {
    if (!confirm('Credit the birthday bonus to ' + (cust.name || 'this customer') + '? Once per year.')) return
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('claim_birthday', {
      p_restaurant_id: me.restaurant_id, p_customer_id: cust.id,
    })
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setResult({ kind: 'bday', amount: data.amount_paise, balance: data.balance_after })
    loadCustomer(cust)
  }

  async function addCustomer() {
    if (!nc.name || nc.name.trim().length < 2) return setErr('Enter the customer name.')
    if (!nc.phone || nc.phone.trim().length < 8) return setErr('Enter a valid phone number.')
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('create_customer', {
      p_restaurant_id: me.restaurant_id, p_phone: nc.phone.trim(), p_name: nc.name.trim(),
      p_birth_date: nc.birth || null, p_anniversary_date: nc.anniv || null,
      p_referral_code: nc.ref ? nc.ref.trim().toUpperCase() : null,
    })
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setLink({ url: customerLink(rest.slug, data.qr_code, data.qr_secret) })
    setNc({ name: '', phone: '', birth: '', anniv: '', ref: '' })
    findCustomer({ term: nc.phone })
  }

  if (phase === 'loading') return <div className="wrap"><p className="muted">Loading…</p></div>
  if (phase === 'error') return <div className="wrap"><div className="err">{err}</div><a className="btn" href="/login">Back to login</a></div>

  const t = cust && cfg && mods.points_on ? tierFor(cust.lifetime_points, cfg.tiers) : null
  const menuCats = [...new Set(menu.map(m => m.category || 'Other'))]
  const hist = [
    ...wtx.filter(x => x.type === 'topup' || x.type === 'adjustment').map(x => ({ at: x.created_at, kind: 'wallet', x })),
    ...stx.map(x => ({ at: x.created_at, kind: 'stamp', x })),
    ...orders.map(o => ({ at: o.created_at, kind: 'order', o })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at))

  return <div className="wrap">
    <div className="spread" style={{ marginBottom: 8 }}>
      <span className="row">
        <button className="btn slim" style={{ width: 'auto', padding: '8px 12px' }} title="Back"
          onClick={() => { if (me && me.role !== 'staff') window.location.href = '/admin'; else if (window.history.length > 1) window.history.back() }}>←</button>
        <h1>{rest.name}</h1>
      </span>
      <span className="row">
        {me && me.role !== 'staff' && <button className="btn slim" onClick={() => { window.location.href = '/admin' }}>Admin view</button>}
        <button className="btn slim" onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}>Log out</button>
      </span>
    </div>
    <div className="spread" style={{ marginBottom: 14 }}>
      {outlets.length > 1
        ? <select className="select" style={{ width: 'auto' }} value={outletId} onChange={e => setOutletId(e.target.value)}>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        : <span className="chip">{outlets[0]?.name || 'No outlet'}</span>}
    </div>

    <div className="card">
      <h2>Customer</h2>
      {!cust && <>
        <div className="row">
          <input className="input grow" placeholder="Search name or phone, then press Enter" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && phone.length >= 3) findCustomer({ term: phone }) }} />
          <button className="btn slim" disabled={busy || phone.length < 3} onClick={() => findCustomer({ term: phone })}>Search</button>
        </div>
        {results && <div style={{ marginTop: 10 }}>
          {results.map(r => <div key={r.id} className="spread sm" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1', cursor: 'pointer' }} onClick={() => { setResults(null); loadCustomer(r) }}>
            <span><b>{r.name || 'Customer'}</b> <span className="muted num">{r.phone}</span></span>
            {mods.wallet_on && <span className="chip">{inr(r.wallet_balance_paise)}</span>}
          </div>)}
        </div>}
      </>}
      {cust && <>
        <div className="spread">
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{cust.name || 'Customer'}</div>
            <div className="muted sm num">{cust.phone}</div>
          </div>
          <button className="btn slim" onClick={() => { setCust(null); setItems([]) }}>Change</button>
        </div>
        {isBday && <div className="ok sm" style={{ marginTop: 10 }}>
          Birthday today! {mods.wallet_on && mk && mk.birthday_paise > 0
            ? <button className="btn slim primary" style={{ marginLeft: 8 }} disabled={busy} onClick={claimBday}>Credit {inr(mk.birthday_paise)} birthday bonus</button>
            : 'Treat them to something on the house.'}
        </div>}
        <div className="row" style={{ marginTop: 12 }}>
          {mods.wallet_on && <div className="grow">
            <div className="xs muted">WALLET</div>
            <div className="big num">{inr(cust.wallet_balance_paise)}</div>
          </div>}
          {mods.points_on && <div style={{ textAlign: 'right' }}>
            <div className="xs muted">POINTS</div>
            <div className="big num">{cust.points_balance}</div>
            {t && <span className={'chip t-' + t.name}>{t.name}</span>}
          </div>}
        </div>
        {mods.stamps_on && prog.map(p => {
          const req = p.stamp_rules.required_count
          const inCard = p.stamps_earned % req
          const unl = Math.floor(p.stamps_earned / req) - (p.rewards_redeemed || 0)
          return <div key={p.stamp_rule_id} style={{ marginTop: 12 }}>
            <div className="spread sm"><b>{p.stamp_rules.name}</b><span className="num">{p.stamps_earned % req} / {req}</span></div>
            <div className="bar"><div style={{ width: (inCard / req) * 100 + '%' }} /></div>
            {unl > 0 && <span className="chip g" style={{ marginTop: 6 }}>{unl} reward ready</span>}
          </div>
        })}
      </>}
    </div>
    {err && <div className="err sm">{err}</div>}

    {cust && <>
      <div className="tabs">
        <button className={tab === 'bill' ? 'on' : ''} onClick={() => setTab('bill')}>New bill</button>
        {mods.wallet_on && <button className={tab === 'topup' ? 'on' : ''} onClick={() => setTab('topup')}>Top-up</button>}
        {mods.stamps_on && <button className={tab === 'stamps' ? 'on' : ''} onClick={() => setTab('stamps')}>Stamps</button>}
        <button className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}>History</button>
        <button className={tab === 'addcust' ? 'on' : ''} onClick={() => setTab('addcust')}>Add customer</button>
      </div>

      {tab === 'bill' && <div className="card">
        {unlocked().map(p => <div key={p.stamp_rule_id} className="row" style={{ marginBottom: 8 }}>
          <span className="chip g grow">{p.stamp_rules.reward_label || p.stamp_rules.name} — unlocked</span>
          <button className="btn slim" onClick={() => applyStamp(p)}>Apply</button>
        </div>)}
        {affordable().map(r => <div key={r.id} className="row" style={{ marginBottom: 8 }}>
          <span className="chip a grow">{r.name} — {r.required_points} pts</span>
          <button className="btn slim" onClick={() => { setRewardSel(r.id); setStampSel(null) }}>
            {rewardSel === r.id ? 'Selected' : 'Apply'}
          </button>
        </div>)}

        {menu.length > 0 && menuCats.map(cat => <div key={cat}>
          <div className="xs muted" style={{ margin: '10px 0 4px' }}>{cat.toUpperCase()}</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {menu.filter(m => (m.category || 'Other') === cat).map(m =>
              <button key={m.id} className="chip" style={{ cursor: 'pointer', fontSize: 13.5 }} onClick={() => addMenu(m)}>
                {m.name} · {inr(m.price_paise)}
              </button>)}
          </div>
        </div>)}
        {menu.length === 0 && recent.length > 0 && <div className="row" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
          {recent.map(it => <button key={it.name} className="chip" style={{ cursor: 'pointer' }} onClick={() => { setItems(xs => [...xs, { name: it.name, category: it.category || '', qty: 1, unit_price_paise: it.unit_price_paise, cost_paise: null, free: false }]); setErr('') }}>
            + {it.name} · {inr(it.unit_price_paise)}
          </button>)}
        </div>}
        {menu.length === 0 && <p className="xs muted">No menu yet — the admin can build it under Admin, Menu. Custom items still work below.</p>}

        <details className="sec" style={{ marginTop: 10 }}>
          <summary className="sm">Custom item</summary>
          <div className="row" style={{ marginTop: 8 }}>
            <input className="input grow" placeholder="Item name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
            <input className="input" style={{ width: 90 }} placeholder="Category" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input className="input" style={{ width: 70 }} type="number" min="1" value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} />
            <input className="input grow" type="number" min="0" step="0.01" placeholder="Price ₹" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} />
            <button className="btn slim primary" onClick={addItem}>Add</button>
          </div>
        </details>

        {items.length > 0 && <div style={{ marginTop: 12 }}>
          {items.map((it, i) => <div key={i} className="spread sm" style={{ padding: '6px 0', borderBottom: '1px solid #F1ECE1' }}>
            <span>{it.free ? <span className="chip g">FREE</span> : null} {it.name} × {it.qty}</span>
            <span className="num">{inr(it.qty * it.unit_price_paise)}
              <button className="btn slim danger" style={{ marginLeft: 8, padding: '2px 8px' }} onClick={() => setItems(xs => xs.filter((_, j) => j !== i))}>✕</button>
            </span>
          </div>)}
          <div className="spread" style={{ marginTop: 10, fontWeight: 800 }}>
            <span>Total</span><span className="num big" style={{ fontSize: 22 }}>{inr(estTotal())}</span>
          </div>
        </div>}

        {mods.wallet_on && <>
          <label className="label">Pay from wallet (max {inr(maxWallet())})</label>
          <input className="input" type="number" min="0" max={(maxWallet() / 100).toFixed(2)} step="0.01" value={walletAmt} onChange={e => { const n = parseFloat(e.target.value); setWalletAmt(e.target.value === '' || isNaN(n) ? '' : String(Math.min(n, maxWallet() / 100))) }} placeholder="0" />
        </>}
        <label className="label">Rest paid by</label>
        <select className="select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
          <option value="cash">Cash</option><option value="card">Card</option>
          <option value="upi">UPI</option><option value="other">Other</option>
        </select>
        <div style={{ height: 16 }} />
        <button className="btn primary" disabled={busy} onClick={submitOrder}>
          {busy ? 'Saving…' : 'Confirm bill — collect ' + inr(estTotal() - toPaise(walletAmt))}
        </button>
      </div>}

      {mods.wallet_on && tab === 'topup' && <div className="card">
        {scheme && <div className="sm muted" style={{ marginBottom: 10 }}>
          Scheme: {inr(scheme.min_topup_paise)} min · <b>+{scheme.bonus_pct}% bonus</b>
          {scheme.bonus_cap_paise ? ' (cap ' + inr(scheme.bonus_cap_paise) + ')' : ''}
        </div>}
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {[500, 1000, 2000, 5000].map(v => {
            const b = scheme ? Math.floor(v * scheme.bonus_pct / 100) : 0
            return <button key={v} className="chip" style={{ cursor: 'pointer', fontSize: 14 }} onClick={() => setTopAmt(String(v))}>
              {b > 0 ? '₹' + v + ' → ₹' + (v + b) : '₹' + v}
            </button>
          })}
        </div>
        <label className="label">Amount (₹)</label>
        <input className="input" type="number" min="0" value={topAmt} onChange={e => setTopAmt(e.target.value)} />
        {toPaise(topAmt) > 0 && <div className="card" style={{ background: '#E7F0EA', marginTop: 10 }}>
          <div className="spread">
            <span><div className="xs muted">CUSTOMER PAYS</div><div className="num" style={{ fontSize: 24, fontWeight: 800 }}>{inr(toPaise(topAmt))}</div></span>
            <span style={{ textAlign: 'right' }}><div className="xs muted">WALLET GETS</div><div className="num" style={{ fontSize: 24, fontWeight: 800, color: '#3E6B4F' }}>{inr(topCredit)}</div></span>
          </div>
          <div className="xs muted" style={{ marginTop: 6 }}>
            {inr(toPaise(topAmt))} + {inr(topBonus)} bonus{scheme ? '' : ' (no bonus scheme configured)'} · New balance {inr(cust.wallet_balance_paise + topCredit)}
          </div>
        </div>}
        <label className="label">Received by</label>
        <select className="select" value={topMethod} onChange={e => setTopMethod(e.target.value)}>
          <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option>
        </select>
        <div style={{ height: 16 }} />
        <button className="btn primary" disabled={busy} onClick={doTopup}>{busy ? 'Saving…' : 'Confirm top-up'}</button>
      </div>}

      {mods.stamps_on && tab === 'stamps' && <div className="card">
        <h2>Stamp cards</h2>
        <p className="sm muted">Add stamps manually — for paper card migration or a missed scan. Every add is logged in History with your name.</p>
        {rules.length === 0 && <p className="sm muted">No stamp rules configured yet — the admin adds them under Admin, Offers.</p>}
        {rules.map(r => {
          const p = prog.find(x => x.stamp_rule_id === r.id)
          const earned = p?.stamps_earned || 0
          const unl = Math.floor(earned / r.required_count) - (p?.rewards_redeemed || 0)
          return <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid #F1ECE1' }}>
            <div className="spread sm"><b>{r.name}</b><span className="num">{earned % r.required_count} / {r.required_count}</span></div>
            <div className="bar"><div style={{ width: ((earned % r.required_count) / r.required_count) * 100 + '%' }} /></div>
            {unl > 0 && <span className="chip g" style={{ marginTop: 4 }}>{unl} reward ready</span>}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn slim" disabled={busy} onClick={() => addStamps(r.id, 1)}>+1 stamp</button>
              <input className="input" style={{ width: 70 }} type="number" min="1" placeholder="#" value={stampQty[r.id] || ''} onChange={e => setStampQty({ ...stampQty, [r.id]: e.target.value })} />
              <button className="btn slim primary" disabled={busy} onClick={() => addStamps(r.id, stampQty[r.id])}>Add</button>
            </div>
          </div>
        })}
      </div>}

      {tab === 'hist' && <div className="card">
        <h2>Recent activity</h2>
        {hist.length === 0 && <p className="sm muted">Nothing yet for this customer.</p>}
        {hist.map(h => {
          if (h.kind === 'wallet') { const x = h.x
            return <div key={x.id} className="spread sm" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1' }}>
              <span><b className="num">{x.amount_paise > 0 ? '+' : ''}{inr(x.amount_paise)}</b> <span className="muted">{x.type === 'topup' ? 'top-up' + (x.bonus_paise ? ' (bonus ' + inr(x.bonus_paise) + ')' : '') : (x.note || 'adjustment')}</span>{x.created_by_name && <span className="chip" style={{ marginLeft: 6 }}>by {x.created_by_name}</span>}</span>
              <span className="muted xs">{fmtDate(x.created_at)}</span>
            </div>
          }
          if (h.kind === 'stamp') { const x = h.x
            return <div key={x.id} className="spread sm" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1' }}>
              <span><b className="num">{x.reward_redeemed ? 'reward' : '+' + x.stamps_awarded}</b> <span className="muted">{x.reward_redeemed ? 'redeemed · ' : 'stamp' + (x.stamps_awarded > 1 ? 's' : '') + ' · '}{x.stamp_rules?.name}</span>{x.note && !x.reward_redeemed && <span className="xs muted"> ({x.note})</span>}{x.created_by_name && <span className="chip" style={{ marginLeft: 6 }}>by {x.created_by_name}</span>}</span>
              <span className="muted xs">{fmtDate(x.created_at)}</span>
            </div>
          }
          const o = h.o
          return <div key={o.id} style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1' }}>
            <div className="spread sm"><span><b className="num">{inr(o.total_paise)}</b> <span className="muted">bill</span>{mods.points_on && o.points_earned > 0 && <span className="chip a" style={{ marginLeft: 6 }}>+{o.points_earned} pts</span>}{o.created_by_name && <span className="chip" style={{ marginLeft: 6 }}>by {o.created_by_name}</span>}</span><span className="muted xs">{fmtDate(o.created_at)}</span></div>
            <div className="xs muted">{(o.items || []).map(it => `${it.name} ×${it.qty}${it.free ? '(free)' : ''}`).join(', ')}</div>
            <div className="xs muted num">{mods.wallet_on ? 'Wallet ' + inr(o.wallet_paid_paise) + ' · ' : ''}{o.payment_method} {inr(o.other_paid_paise)}</div>
          </div>
        })}
      </div>}

      {tab === 'addcust' && <div className="card">
        <p className="sm muted">Creates a new loyalty customer with their QR + portal link. Birthdays power the birthday reward; a referral code credits both wallets instantly.</p>
        <label className="label">Name</label>
        <input className="input" value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} />
        <label className="label">Phone</label>
        <input className="input" type="tel" value={nc.phone} onChange={e => setNc({ ...nc, phone: e.target.value })} />
        <div className="row">
          <div className="grow"><label className="label">Birthday (optional)</label><input className="input" type="date" value={nc.birth} onChange={e => setNc({ ...nc, birth: e.target.value })} /></div>
          <div className="grow"><label className="label">Anniversary (optional)</label><input className="input" type="date" value={nc.anniv} onChange={e => setNc({ ...nc, anniv: e.target.value })} /></div>
        </div>
        <label className="label">Referral code from a friend (optional)</label>
        <input className="input" style={{ textTransform: 'uppercase' }} value={nc.ref} onChange={e => setNc({ ...nc, ref: e.target.value })} placeholder="e.g. A3F9K2" />
        <div style={{ height: 16 }} />
        <button className="btn primary" disabled={busy} onClick={addCustomer}>{busy ? 'Creating…' : 'Create customer'}</button>
      </div>}
    </>}

    {!cust && <div className="card">
      <h3>New customer? Add them here</h3>
      <p className="sm muted" style={{ margin: '6px 0 12px' }}>Creates a loyalty customer and shows their QR + personal portal link.</p>
      <input className="input" style={{ marginBottom: 8 }} placeholder="Name" value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} />
      <input className="input" style={{ marginBottom: 8 }} type="tel" placeholder="Phone" value={nc.phone} onChange={e => setNc({ ...nc, phone: e.target.value })} />
      <button className="btn primary" disabled={busy} onClick={addCustomer}>{busy ? 'Creating…' : 'Create customer'}</button>
    </div>}

    {result && <div className="overlay" onClick={() => setResult(null)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {result.kind === 'stamps'
          ? <>
              <h2>Stamps added</h2>
              <p>Card total: <b className="num">{result.total}</b> stamps</p>
              {result.unlocked > 0 && <div className="ok sm" style={{ marginTop: 8 }}>{result.unlocked} reward ready — apply it on the next bill.</div>}
            </>
          : result.kind === 'bday'
          ? <>
              <h2>Birthday credit given</h2>
              <p>Added <b className="num">{inr(result.amount)}</b> to the wallet.</p>
              <p className="sm muted">New balance <b className="num">{inr(result.balance)}</b></p>
            </>
          : result.kind === 'topup'
          ? <>
              <h2>Top-up done</h2>
              <p>Wallet got <b className="num">{inr(result.balance_after)}</b> in total.</p>
              <p className="sm muted">Bonus {inr(result.bonus_paise)} · New balance <b className="num">{inr(result.balance_after)}</b></p>
            </>
          : <>
              <h2>Bill saved</h2>
              <div className="spread sm" style={{ margin: '10px 0' }}><span>Total bill</span><b className="num">{inr(result.total_paise)}</b></div>
              {mods.wallet_on && <div className="spread sm"><span>Paid from wallet</span><b className="num">{inr(result.wallet_paid_paise)}</b></div>}
              <div className="spread sm"><span>Collect now</span><b className="num">{inr(result.other_paid_paise)}</b></div>
              {cust && mods.wallet_on && <div className="spread sm"><span>Wallet balance</span><b className="num">{inr(result.wallet_balance_after)}</b></div>}
              {cust && mods.points_on && <div className="spread sm"><span>Points earned</span><b className="num">+{result.points_earned}</b> (balance {result.points_balance_after})</div>}
              {mods.stamps_on && (result.stamps || []).filter(s => s.unlocked_now > 0).map(s =>
                <div key={s.rule_id} className="ok sm" style={{ marginTop: 8 }}>Stamp card reward unlocked — customer now has {s.unlocked_now} free reward(s).</div>)}
              {cust && result.order_id && <>
                <div style={{ height: 12 }} />
                <button className="btn" onClick={sendFeedbackReq}>Ask for feedback on WhatsApp</button>
              </>}
            </>}
        <div style={{ height: 14 }} />
        <button className="btn primary" onClick={() => setResult(null)}>Done</button>
      </div>
    </div>}

    {link && <div className="overlay" onClick={() => setLink(null)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Customer created</h2>
        <p className="sm muted">Customer scans or photographs this QR. It is their portal link and their loyalty card.</p>
        <div style={{ padding: 16 }}><QRCodeSVG value={link.url} size={220} /></div>
        <p className="xs muted" style={{ wordBreak: 'break-all' }}>{link.url}</p>
        <div style={{ height: 12 }} />
        <button className="btn" onClick={() => navigator.clipboard?.writeText(link.url)}>Copy link</button>
        <div style={{ height: 8 }} />
        <button className="btn primary" onClick={() => setLink(null)}>Done</button>
      </div>
    </div>}
  </div>
}
