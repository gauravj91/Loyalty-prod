'use client'
import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { inr, fmtDate, tierFor, nextTierFor, errMsg } from '../lib/helpers'

const LS = 'tessera_customer'

export default function CustomerPortal() {
  const [status, setStatus] = useState('loading') // loading | need_link | ready
  const [err, setErr] = useState('')
  const [cust, setCust] = useState(null)
  const [rules, setRules] = useState([]); const [prog, setProg] = useState([])
  const [cfg, setCfg] = useState(null); const [rewards, setRewards] = useState([]); const [reds, setReds] = useState([])
  const [txns, setTxns] = useState([]); const [orders, setOrders] = useState([])
  const [open, setOpen] = useState(null); const [showQr, setShowQr] = useState(false)

  useEffect(() => { boot() }, [])

  async function boot() {
    const q = new URLSearchParams(window.location.search)
    let slug = q.get('slug'), qr = q.get('qr'), secret = q.get('k')
    if (!qr) {
      const saved = JSON.parse(localStorage.getItem(LS) || 'null')
      if (saved) ({ slug, qr, secret } = saved)
    }
    if (!qr) return setStatus('need_link')
    try {
      let { data: { session } } = await supabase.auth.getSession()
      if (!session) { const s = await supabase.auth.signInAnonymously(); if (s.error) throw s.error }
      const { data: cid, error } = await supabase.rpc('customer_sign_in', { p_slug: slug, p_qr_code: qr, p_secret: secret })
      if (error) throw error
      localStorage.setItem(LS, JSON.stringify({ slug, qr, secret }))
      await load(cid)
    } catch (e) { setErr(errMsg(e)); setStatus('need_link') }
  }

  async function load(cid) {
    const c = await supabase.from('customers').select('*, restaurants(name)').eq('id', cid).single()
    if (c.error) throw c.error
    setCust(c.data)
    const rid = c.data.restaurant_id
    const [ru, pr, cf, rw, rd, tx, or] = await Promise.all([
      supabase.from('stamp_rules').select('*').eq('restaurant_id', rid).eq('active', true),
      supabase.from('customer_stamp_progress').select('*').eq('customer_id', cid),
      supabase.from('points_config').select('*').eq('restaurant_id', rid).maybeSingle(),
      supabase.from('rewards').select('*').eq('restaurant_id', rid).eq('active', true),
      supabase.from('reward_redemptions').select('reward_id').eq('customer_id', cid),
      supabase.from('wallet_transactions').select('*').eq('customer_id', cid).order('created_at', { ascending: false }).limit(15),
      supabase.from('orders').select('*').eq('customer_id', cid).order('created_at', { ascending: false }).limit(10),
    ])
    setRules(ru.data || []); setProg(pr.data || []); setCfg(cf.data)
    setRewards(rw.data || []); setReds(rd.data || [])
    setTxns(tx.data || []); setOrders(or.data || [])
    setStatus('ready')
  }

  async function logout() {
    await supabase.auth.signOut(); localStorage.removeItem(LS); setStatus('need_link')
  }

  if (status === 'loading') return <div className="wrap"><p className="muted">Loading…</p></div>

  if (status === 'need_link') return <div className="wrap" style={{ paddingTop: 60 }}>
    <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 22, color: '#C2511F' }}>Tessera</div>
    <div className="card" style={{ marginTop: 20 }}>
      <h2>Open your loyalty page</h2>
      <p className="sm muted" style={{ marginTop: 8 }}>
        This page needs your personal loyalty link. Open the link or scan the QR card your restaurant gave you —
        it looks like <b>…/customer?slug=…&amp;qr=…&amp;k=…</b>. Tip: bookmark it or keep the photo of your QR card.
      </p>
      {err && <div className="err sm" style={{ marginTop: 12 }}>{err}</div>}
    </div>
  </div>

  const t = tierFor(cust.lifetime_points, cfg?.tiers)
  const nt = nextTierFor(cust.lifetime_points, cfg?.tiers)
  const ready = rewards.filter(r => cust.points_balance >= r.required_points && (r.max_per_customer === 0 || reds.filter(x => x.reward_id === r.id).length < r.max_per_customer))
  const activity = [
    ...orders.map(o => ({ at: o.created_at, kind: 'order', o })),
    ...txns.filter(x => x.type === 'topup' || x.type === 'adjustment').map(x => ({ at: x.created_at, kind: 'wallet', x })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10)

  return <div className="wrap">
    <div className="spread" style={{ marginBottom: 16 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 20, color: '#C2511F' }}>{cust.restaurants?.name || 'Loyalty'}</div>
        <div className="muted sm">Hi {cust.name || 'there'} 👋</div>
      </div>
      <button className="btn slim" onClick={logout}>Log out</button>
    </div>
    {err && <div className="err sm">{err}</div>}

    <div className="card">
      <div className="xs muted">WALLET BALANCE</div>
      <div className="big num">{inr(cust.wallet_balance_paise)}</div>
      <div className="xs muted" style={{ marginTop: 6 }}>Show your QR at the counter to pay from this balance.</div>
    </div>

    <div className="card">
      <div className="spread">
        <div><div className="xs muted">POINTS</div><div className="big num">{cust.points_balance}</div></div>
        <span className={'chip t-' + (t?.name || 'Bronze')}>{t?.name || 'Bronze'}</span>
      </div>
      {nt && <div className="sm muted" style={{ marginTop: 6 }}>{nt.min - cust.lifetime_points} more points to reach <b>{nt.name}</b></div>}
      {ready.length > 0 && <div style={{ marginTop: 12 }}>
        {ready.map(r => <div key={r.id} className="chip g" style={{ margin: '2px 4px 2px 0' }}>You can claim: {r.name}</div>)}
      </div>}
    </div>

    {rules.length > 0 && <div className="card">
      <h2>My stamp cards</h2>
      {rules.map(r => {
        const p = prog.find(x => x.stamp_rule_id === r.id)
        const earned = p?.stamps_earned || 0
        const unl = Math.floor(earned / r.required_count) - (p?.rewards_redeemed || 0)
        return <div key={r.id} style={{ marginTop: 10 }}>
          <div className="spread sm"><b>{r.name}</b><span className="num">{earned % r.required_count} / {r.required_count}</span></div>
          <div className="bar"><div style={{ width: ((earned % r.required_count) / r.required_count) * 100 + '%' }} /></div>
          {unl > 0 && <div className="chip g" style={{ marginTop: 6 }}>{unl} free reward ready — ask at the counter</div>}
        </div>
      })}
    </div>}

    <div className="card">
      <h2>Recent activity</h2>
      {activity.length === 0 && <p className="sm muted">Nothing yet — your first visit will show up here.</p>}
      {activity.map((a, i) => <div key={i}>
        {a.kind === 'order'
          ? <div className="spread sm" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1', cursor: 'pointer' }} onClick={() => setOpen(open === i ? null : i)}>
              <span><b className="num">{inr(a.o.total_paise)}</b> <span className="muted">bill</span>{a.o.points_earned > 0 && <span className="chip a" style={{ marginLeft: 6 }}>+{a.o.points_earned} pts</span>}</span>
              <span className="muted xs">{fmtDate(a.at)}</span>
            </div>
          : <div className="spread sm" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1' }}>
              <span><b className="num">{a.x.amount_paise > 0 ? '+' : ''}{inr(a.x.amount_paise)}</b> <span className="muted">{a.x.type === 'topup' ? 'wallet top-up' : 'adjustment'}</span></span>
              <span className="muted xs">{fmtDate(a.at)}</span>
            </div>}
        {open === i && a.kind === 'order' && <div className="sm muted" style={{ padding: '8px 0 4px' }}>
          {(a.o.items || []).map((it, j) => <div key={j}>{it.name} × {it.qty} {it.free ? '(free)' : ''}</div>)}
          <div style={{ marginTop: 4 }}>Wallet paid: {inr(a.o.wallet_paid_paise)} · Cash/card: {inr(a.o.other_paid_paise)}</div>
        </div>}
      </div>)}
    </div>

    <button className="btn primary btn-lg" onClick={() => setShowQr(true)}>Show my QR code</button>
    <p className="muted sm" style={{ textAlign: 'center', marginTop: 8 }}>Show this at the counter to earn stamps, points and use your wallet.</p>

    {showQr && <div className="overlay" onClick={() => setShowQr(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>My QR code</h2>
        <div style={{ padding: 16 }}><QRCodeSVG value={window.location.href} size={230} /></div>
        <p className="sm muted">Let the staff scan this. Keep this page bookmarked.</p>
        <div style={{ height: 12 }} />
        <button className="btn primary" onClick={() => setShowQr(false)}>Done</button>
      </div>
    </div>}
  </div>
}
