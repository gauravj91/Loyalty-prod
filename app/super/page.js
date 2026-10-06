'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { inr, fmtDate, errMsg } from '../lib/helpers'

export default function Super() {
  const [phase, setPhase] = useState('loading')
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ name: '', slug: '', email: '' })

  useEffect(() => { (async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    const { data: pa } = await supabase.from('platform_admins').select('user_id').eq('user_id', session.user.id)
    if (!pa?.length) { setErr('Not a platform admin.'); setPhase('denied'); return }
    await load(); setPhase('ready')
  })() }, [])

  async function load() {
    const { data, error } = await supabase.rpc('super_overview')
    if (error) return setErr(errMsg(error))
    setRows(data || [])
  }

  async function createResto() {
    const clean = f.slug.toLowerCase().replace(/[^a-z0-9-]/g, '')
    const { error } = await supabase.from('restaurants').insert({ name: f.name, slug: clean })
    if (error) return setErr(errMsg(error))
    if (f.email) {
      const { error: e2 } = await supabase.rpc('add_staff', {
        p_restaurant_id: (await supabase.from('restaurants').select('id').eq('slug', clean).single()).data.id,
        p_email: f.email, p_role: 'owner',
      })
      if (e2) return setErr(errMsg(e2))
    }
    setMsg('Restaurant created.'); setF({ name: '', slug: '', email: '' }); load()
  }

  function issues(r) {
    const out = []
    if (!r.onboarded) out.push('Onboarding incomplete')
    if (Number(r.outlets_count) === 0) out.push('No outlet')
    if (Number(r.staff_count) <= 1) out.push('No staff added')
    if (!r.has_wallet && !r.has_stamps && !r.has_rewards) out.push('No offers configured')
    if (Number(r.menu_count) === 0) out.push('Menu empty')
    if (Number(r.orders_total) === 0) out.push('No orders yet')
    else if (r.last_order_at && (Date.now() - new Date(r.last_order_at).getTime()) > 7 * 86400000) out.push('No orders in 7+ days')
    return out
  }

  if (phase === 'loading') return <div className="wrap"><p className="muted">Loading…</p></div>
  if (phase === 'denied') return <div className="wrap"><div className="err">{err}</div></div>

  const totals = {
    restaurants: rows.length,
    active: rows.filter(r => Number(r.orders_7d) > 0).length,
    customers: rows.reduce((s, r) => s + Number(r.customers_count || 0), 0),
    liability: rows.reduce((s, r) => s + Number(r.wallet_liability || 0), 0),
  }

  return <div className="wrap wide">
    <div className="spread" style={{ marginBottom: 14 }}>
      <h1>Platform admin</h1>
      <button className="btn slim" onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}>Log out</button>
    </div>
    {msg && <div className="ok sm">{msg}</div>}
    {err && <div className="err sm">{err}</div>}

    <div className="card">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="grow"><div className="xs muted">RESTAURANTS</div><div className="big num">{totals.restaurants}</div></div>
        <div className="grow"><div className="xs muted">ACTIVE (7d)</div><div className="big num">{totals.active}</div></div>
        <div className="grow"><div className="xs muted">CUSTOMERS</div><div className="big num">{totals.customers}</div></div>
        <div className="grow"><div className="xs muted">WALLET OWED</div><div className="big num">{inr(totals.liability)}</div></div>
      </div>
    </div>

    <div className="card">
      <h2>Usage & health</h2>
      <div style={{ overflowX: 'auto' }}>
        <table className="t"><thead><tr><th>Restaurant</th><th>Customers</th><th>7d</th><th>Bills</th><th>Last order</th><th>Staff</th><th>Menu</th><th>Wallet owed</th><th>Attention</th></tr></thead><tbody>
          {rows.map(r => {
            const iss = issues(r)
            return <tr key={r.restaurant_id}>
              <td><b>{r.name}</b><div className="xs muted">/{r.slug} · joined {fmtDate(r.created_at)}</div></td>
              <td className="num">{r.customers_count}</td>
              <td className="num">{r.orders_7d}</td>
              <td className="num">{r.orders_total}</td>
              <td className="xs">{r.last_order_at ? fmtDate(r.last_order_at) : '—'}</td>
              <td className="num">{r.staff_count}</td>
              <td className="num">{r.menu_count}</td>
              <td className="num">{inr(r.wallet_liability)}</td>
              <td>{iss.length === 0
                ? <span className="chip g">Healthy</span>
                : iss.map(i => <span key={i} className="chip r" style={{ margin: 2 }}>{i}</span>)}</td>
            </tr>
          })}
        </tbody></table>
      </div>
      {rows.length === 0 && <p className="sm muted">No restaurants yet.</p>}
    </div>

    <div className="card">
      <h2>Add restaurant (for a new client)</h2>
      <div className="row" style={{ marginTop: 8 }}>
        <input className="input grow" placeholder="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <input className="input" style={{ width: 130 }} placeholder="slug" value={f.slug} onChange={e => setF({ ...f, slug: e.target.value })} />
      </div>
      <input className="input" style={{ marginTop: 8 }} placeholder="Owner email (must have signed up)" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
      <div style={{ height: 12 }} />
      <button className="btn primary" onClick={createResto}>Create restaurant</button>
    </div>
  </div>
}
