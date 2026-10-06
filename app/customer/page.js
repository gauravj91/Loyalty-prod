'use client'
import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { inr, fmtDate, tierFor, nextTierFor, errMsg } from '../../lib/helpers'

const LS = 'tessera_customer'

const Lock = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ verticalAlign: '-1px', marginLeft: 4 }}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>

export default function CustomerPortal() {
  const [status, setStatus] = useState('loading')
  const [err, setErr] = useState('')
  const [cust, setCust] = useState(null)
  const [mk, setMk] = useState(null)
  const [mods, setMods] = useState({ wallet_on: true, stamps_on: true, points_on: true })
  const [rules, setRules] = useState([]); const [prog, setProg] = useState([])
  const [cfg, setCfg] = useState(null); const [rewards, setRewards] = useState([]); const [reds, setReds] = useState([])
  const [txns, setTxns] = useState([]); const [orders, setOrders] = useState([]); const [stx, setStx] = useState([])
  const [visits, setVisits] = useState(0)
  const [open, setOpen] = useState(null); const [showQr, setShowQr] = useState(false)
  const [invite, setInvite] = useState(null)
  const [fbFor, setFbFor] = useState(null); const [fbStars, setFbStars] = useState(0)
  const [fbComment, setFbComment] = useState(''); const [fbDone, setFbDone] = useState(false)
  const [copied, setCopied] = useState(false); const [slug, setSlug] = useState('')

  useEffect(() => { boot() }, [])

  async function boot() {
    const q = new URLSearchParams(window.location.search)
    let slug = q.get('slug'), qr = q.get('qr'), secret = q.get('k')
    const ref = q.get('ref'), fb = q.get('fb')
    if (ref) setInvite(ref.toUpperCase())
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
      setSlug(slug || '')
      await load(cid)
      if (fb) setFbFor(fb)
    }     } catch (e) {
      const m = errMsg(e)
      setErr(/anonym/i.test(m) ? 'This link could not be opened because guest access is switched off. The restaurant owner can enable it in Supabase: Authentication → Anonymous sign-ins.' : m)
      setStatus('need_link')
    }
  }

  async function load(cid) {
    const c = await supabase.from('customers').select('*, restaurants(name, logo_url, cover_url, rewards_terms)').eq('id', cid).single()
    if (c.error) throw c.error
    setCust(c.data)
    const rid = c.data.restaurant_id
    const [ru, pr, cf, rw, rd, tx, or, mkq, mdq, st, vc] = await Promise.all([
      supabase.from('stamp_rules').select('*').eq('restaurant_id', rid).eq('active', true),
      supabase.from('customer_stamp_progress').select('*').eq('customer_id', cid),
      supabase.from('points_config').select('*').eq('restaurant_id', rid).maybeSingle(),
      supabase.from('rewards').select('*').eq('restaurant_id', rid).eq('active', true).order('required_points'),
      supabase.from('reward_redemptions').select('reward_id').eq('customer_id', cid),
      supabase.from('wallet_transactions').select('*').eq('customer_id', cid).order('created_at', { ascending: false }).limit(15),
      supabase.from('orders').select('*').eq('customer_id', cid).order('created_at', { ascending: false }).limit(10),
      supabase.from('marketing_config').select('*').eq('restaurant_id', rid).maybeSingle(),
      supabase.from('modules_config').select('*').eq('restaurant_id', rid).maybeSingle(),
      supabase.from('stamp_transactions').select('*, stamp_rules(name)').eq('customer_id', cid).order('created_at', { ascending: false }).limit(10),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('customer_id', cid),
    ])
    setRules(ru.data || []); setProg(pr.data || []); setCfg(cf.data)
    setRewards(rw.data || []); setReds(rd.data || [])
    setTxns(tx.data || []); setOrders(or.data || []); setStx(st.data || [])
    setVisits(vc.count || 0)
    setMk(mkq.data || null)
    if (mdq.data) setMods(mdq.data)
    setStatus('ready')
  }

  async function submitFb() {
    if (!fbStars) return
    const { error } = await supabase.from('feedback').insert({
      restaurant_id: cust.restaurant_id, customer_id: cust.id, order_id: fbFor,
      stars: fbStars, comment: fbComment.trim() || null,
    })
    if (error) return setErr(errMsg(error))
    setFbDone(true)
  }

  async function logout() {
    await supabase.auth.signOut(); localStorage.removeItem(LS); setStatus('need_link')
  }

  if (status === 'loading') return <div className="wrap"><p className="muted">Loading…</p></div>

  if (status === 'need_link') return <div className="wrap" style={{ paddingTop: 60 }}>
    <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 22, color: '#C2511F' }}>Tessera</div>
    <div className="card" style={{ marginTop: 20 }}>
      {invite
        ? <>
            <h2>You're invited!</h2>
            <p className="sm muted" style={{ marginTop: 8 }}>
              Visit the restaurant and tell the counter your friend's referral code — you'll both get wallet credit when you join.
            </p>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4, textAlign: 'center', padding: '12px 0' }}>{invite}</div>
            <button className="btn" onClick={() => { navigator.clipboard?.writeText(invite); setCopied(true) }}>{copied ? 'Copied' : 'Copy code'}</button>
          </>
        : <>
            <h2>Open your loyalty page</h2>
            <p className="sm muted" style={{ marginTop: 8 }}>
              This page needs your personal loyalty link. Open the link or scan the QR card your restaurant gave you —
              it looks like <b>…/customer?slug=…&amp;qr=…&amp;k=…</b>. Tip: bookmark it or keep the photo of your QR card.
            </p>
          </>}
      {err && <div className="err sm" style={{ marginTop: 12 }}>{err}</div>}
    </div>
  </div>

  const t = mods.points_on ? tierFor(cust.lifetime_points, cfg?.tiers) : null
  const ppr = cfg?.points_per_rupee || 0
  const earnPts = ppr > 0 ? Math.round(ppr * 100 * 10) / 10 : 0
  const canClaim = mods.points_on ? rewards.filter(r => cust.points_balance >= r.required_points) : []
  const next = mods.points_on ? rewards.filter(r => r.required_points > cust.points_balance)[0] : null
  const nextRupees = next && ppr > 0 ? Math.ceil((next.required_points - cust.points_balance) / ppr) : null
  const nextPct = next ? Math.min(100, Math.round(cust.points_balance / next.required_points * 100)) : 0
  const rest_ = cust.restaurants || {}
  const activity = [
    ...orders.map(o => ({ at: o.created_at, kind: 'order', o })),
    ...txns.filter(x => x.type === 'topup' || x.type === 'adjustment').map(x => ({ at: x.created_at, kind: 'wallet', x })),
    ...stx.map(x => ({ at: x.created_at, kind: 'stamp', x })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12)
  const inviteLink = (typeof window !== 'undefined' ? window.location.origin : '') + '/customer?slug=' + slug + '&ref=' + cust.referral_code
  const shareTxt = (mk && mk.referrer_paise > 0
    ? 'Join ' + (rest_.name || 'this restaurant') + ' with my code ' + cust.referral_code + ' — we both get ' + inr(mk.referrer_paise) + ' in wallet credit. Open this link and show the code at the counter: ' + inviteLink
    : 'Join ' + (rest_.name || 'this restaurant') + ' with my code ' + cust.referral_code + '. Open this link and show the code at the counter: ' + inviteLink)

  return <div className="wrap" style={{ paddingBottom: 90 }}>
    <div style={{ background: 'linear-gradient(135deg,#C2511F,#E07A4A)', margin: '-20px -16px 0', padding: '22px 16px 46px', color: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
      <div className="spread">
        <span className="sm" style={{ fontWeight: 800, opacity: .9 }}>{rest_.name}</span>
        <button className="btn slim" style={{ width: 'auto', background: 'rgba(255,255,255,.18)', color: '#fff', borderColor: 'transparent' }} onClick={logout}>Log out</button>
      </div>
      <div style={{ fontSize: 27, fontWeight: 800, marginTop: 12, letterSpacing: '-.02em' }}>Hello {cust.name || 'there'}</div>
      {mods.points_on && <div style={{ marginTop: 6, fontSize: 15.5 }}>
        You have <b className="num" style={{ fontSize: 19 }}>{cust.points_balance}</b> points
        {t && <span className="chip" style={{ marginLeft: 8, background: 'rgba(255,255,255,.2)', color: '#fff' }}>{t.name}</span>}
      </div>}
      {mods.wallet_on && <div className="sm num" style={{ marginTop: 3, opacity: .95 }}>Wallet balance {inr(cust.wallet_balance_paise)}</div>}
      {canClaim.length > 0 && <div className="chip" style={{ marginTop: 10, background: '#fff', color: '#3E6B4F' }}>{canClaim.length} reward{canClaim.length > 1 ? 's' : ''} unlocked — claim at the counter</div>}
    </div>

    <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: -30, position: 'relative' }}>
      <div style={{ height: 120, background: rest_.cover_url ? 'url(' + rest_.cover_url + ') center/cover' : 'linear-gradient(135deg,#221D16,#6B5138)' }} />
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ width: 76, height: 76, borderRadius: '50%', border: '4px solid #fff', background: '#fff', marginTop: -40, boxShadow: '0 2px 10px rgba(34,29,22,.18)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {rest_.logo_url
            ? <img src={rest_.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontWeight: 800, fontSize: 26, color: '#C2511F' }}>{(rest_.name || 'R')[0]}</span>}
        </div>
        <h2 style={{ fontSize: 21, marginTop: 8 }}>{rest_.name}</h2>
        <div className="sm muted">Get rewarded on every visit</div>
        <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          {earnPts > 0 && <span className="chip a">₹100 spent = {earnPts} points</span>}
          <span className="chip">{visits} visit{visits === 1 ? '' : 's'} with us</span>
        </div>
      </div>
    </div>

    {mods.points_on && rewards.length > 0 && <div className="card" style={{ background: '#221D16', borderColor: '#221D16', color: '#fff', marginTop: 14 }}>
      <h2 style={{ color: '#fff' }}>Loyalty rewards</h2>
      {next && <div style={{ marginTop: 10 }}>
        <div className="sm" style={{ opacity: .95 }}>
          {nextPct >= 60 ? 'Almost there! ' : ''}Spend <b className="num">{inr(nextRupees * 100)}</b> more to unlock <b>{next.name}</b>
        </div>
        <div className="bar" style={{ background: 'rgba(255,255,255,.14)', marginTop: 8 }}>
          <div style={{ width: nextPct + '%', background: 'linear-gradient(90deg,#E07A4A,#F0A57E)', transition: 'width .6s' }} />
        </div>
      </div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        {rewards.map(r => {
          const has = cust.points_balance >= r.required_points
          return <div key={r.id} style={{ background: has ? 'rgba(224,122,74,.16)' : 'rgba(255,255,255,.06)', border: has ? '1.5px solid #E07A4A' : '1px solid rgba(255,255,255,.14)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.01em' }}>
              {r.required_points}<span style={{ fontSize: 10.5, fontWeight: 800, opacity: .75, marginLeft: 4 }}>PTS</span>
              {!has && <Lock />}
            </div>
            <div style={{ fontWeight: 700, marginTop: 4, fontSize: 13.5 }}>{r.name}</div>
            {r.description && <div className="xs" style={{ opacity: has ? .85 : .6, marginTop: 2 }}>{r.description}</div>}
            {has && <div className="xs" style={{ color: '#F0A57E', fontWeight: 800, marginTop: 6 }}>Ready — ask at the counter</div>}
          </div>
        })}
      </div>
      {rest_.rewards_terms && <details style={{ marginTop: 16 }}>
        <summary className="sm" style={{ fontWeight: 800 }}>Terms &amp; Conditions</summary>
        <div className="xs" style={{ opacity: .8, whiteSpace: 'pre-wrap', marginTop: 8, border: '1px dashed rgba(255,255,255,.3)', borderRadius: 10, padding: 10 }}>{rest_.rewards_terms}</div>
      </details>}
    </div>}

    {mods.points_on && rewards.length > 0 && <div className="card" style={{ background: '#F1ECE1' }}>
      <h3>How to redeem?</h3>
      <p className="sm muted" style={{ marginTop: 4 }}>Show your QR code at the counter and tell our team which reward you'd like. They'll apply it to your bill on the spot.</p>
    </div>}

    {mods.stamps_on && rules.length > 0 && <div className="card">
      <h2>My stamp cards</h2>
      {rules.map(r => {
        const p = prog.find(x => x.stamp_rule_id === r.id)
        const earned = p?.stamps_earned || 0
        const unl = Math.floor(earned / r.required_count) - (p?.rewards_redeemed || 0)
        return <div key={r.id} style={{ marginTop: 10 }}>
          <div className="spread sm"><b>{r.name}</b><span className="num">{earned % r.required_count} / {r.required_count}</span></div>
          <div className="bar"><div style={{ width: ((earned % r.required_count) / r.required_count) * 100 + '%', transition: 'width .6s' }} /></div>
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
          : a.kind === 'stamp'
          ? <div className="spread sm" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1' }}>
              <span><b className="num">{a.x.reward_redeemed ? 'reward' : '+' + a.x.stamps_awarded}</b> <span className="muted">{a.x.reward_redeemed ? 'redeemed · ' : 'stamp' + (a.x.stamps_awarded > 1 ? 's' : '') + ' · '}{a.x.stamp_rules?.name}</span></span>
              <span className="muted xs">{fmtDate(a.at)}</span>
            </div>
          : <div className="spread sm" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1' }}>
              <span><b className="num">{a.x.amount_paise > 0 ? '+' : ''}{inr(a.x.amount_paise)}</b> <span className="muted">{a.x.type === 'topup' ? 'wallet top-up' : (a.x.note || 'adjustment')}</span></span>
              <span className="muted xs">{fmtDate(a.at)}</span>
            </div>}
        {open === i && a.kind === 'order' && <div className="sm muted" style={{ padding: '8px 0 4px' }}>
          {(a.o.items || []).map((it, j) => <div key={j}>{it.name} × {it.qty} {it.free ? '(free)' : ''}</div>)}
          <div style={{ marginTop: 4 }}>Wallet paid: {inr(a.o.wallet_paid_paise)} · Cash/card: {inr(a.o.other_paid_paise)}</div>
        </div>}
      </div>)}
    </div>

    {cust.referral_code && <div className="card">
      <h2>Refer a friend</h2>
      <p className="sm muted" style={{ marginTop: 4 }}>
        {mk && mk.referrer_paise > 0
          ? 'Share your code — when they join, you get ' + inr(mk.referrer_paise) + ' and they get ' + inr(mk.referee_paise) + ' in wallet credit.'
          : 'Share your code — when they join and quote it at the counter, you both get wallet credit.'}
      </p>
      <div className="spread" style={{ marginTop: 8 }}>
        <b style={{ fontSize: 24, letterSpacing: 4 }}>{cust.referral_code}</b>
        <a className="btn slim primary" target="_blank" rel="noreferrer" href={'https://wa.me/?text=' + encodeURIComponent(shareTxt)}>Share on WhatsApp</a>
      </div>
    </div>}

    <button className="btn primary btn-lg" onClick={() => setShowQr(true)}>Show my QR code</button>
    <p className="muted sm" style={{ textAlign: 'center', marginTop: 8 }}>Show this at the counter to earn rewards and use your wallet.</p>

    {showQr && <div className="overlay" onClick={() => setShowQr(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>My QR code</h2>
        <div style={{ padding: 16 }}><QRCodeSVG value={window.location.href} size={230} /></div>
        <p className="sm muted">Let the staff scan this. Keep this page bookmarked.</p>
        <div style={{ height: 12 }} />
        <button className="btn primary" onClick={() => setShowQr(false)}>Done</button>
      </div>
    </div>}

    {fbFor && <div className="overlay">
      <div className="modal">
        {!fbDone
          ? <>
              <h2>How was your visit?</h2>
              <div className="row" style={{ justifyContent: 'center', margin: '14px 0' }}>
                {[1, 2, 3, 4, 5].map(n => <button key={n} style={{ fontSize: 34, background: 'none', border: 'none', cursor: 'pointer', color: n <= fbStars ? '#C2511F' : '#D9D2C4', padding: 4 }} onClick={() => setFbStars(n)}>★</button>)}
              </div>
              {fbStars > 0 && <>
                <input className="input" placeholder="Anything to add? (optional)" value={fbComment} onChange={e => setFbComment(e.target.value)} />
                <div style={{ height: 12 }} />
                <button className="btn primary" onClick={submitFb}>Send rating</button>
              </>}
            </>
          : <>
              <h2>Thank you!</h2>
              <p className="sm muted" style={{ marginTop: 8 }}>Your rating means a lot to us.</p>
            </>}
        <div style={{ height: 12 }} />
        <button className="btn" onClick={() => { setFbFor(null); try { const u = new URL(window.location.href); u.searchParams.delete('fb'); window.history.replaceState({}, '', u) } catch (e) {} }}>{fbDone ? 'Close' : 'Not now'}</button>
      </div>
    </div>}
  </div>
}
