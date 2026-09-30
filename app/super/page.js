'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { errMsg } from '../lib/helpers'

export default function Super() {
  const [phase, setPhase] = useState('loading'); const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const [rests, setRests] = useState([]); const [counts, setCounts] = useState({})
  const [f, setF] = useState({ name: '', slug: '', email: '' })

  useEffect(() => { (async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    const { data: pa } = await supabase.from('platform_admins').select('user_id').eq('user_id', session.user.id)
    if (!pa?.length) { setErr('Not a platform admin.'); setPhase('denied'); return }
    await load(); setPhase('ready')
  })() }, [])

  async function load() {
    const { data: rs } = await supabase.from('restaurants').select('*').order('created_at')
    const { data: cs } = await supabase.from('customers').select('restaurant_id')
    const c = {}; (cs || []).forEach(x => c[x.restaurant_id] = (c[x.restaurant_id] || 0) + 1)
    setRests(rs || []); setCounts(c)
  }

  async function createResto() {
    const { error } = await supabase.from('restaurants').insert({ name: f.name, slug: f.slug.toLowerCase().replace(/[^a-z0-9-]/g, '') })
    if (error) return setErr(errMsg(error))
    const { data: r } = await supabase.from('restaurants').select('id').eq('slug', f.slug.toLowerCase().replace(/[^a-z0-9-]/g, '')).single()
    if (f.email) {
      const { error: e2 } = await supabase.rpc('add_staff', { p_restaurant_id: r.id, p_email: f.email, p_role: 'owner' })
      if (e2) return setErr(errMsg(e2))
    }
    setMsg('Restaurant created.'); setF({ name: '', slug: '', email: '' }); load()
  }

  if (phase === 'loading') return <div className="wrap"><p className="muted">Loading…</p></div>
  if (phase === 'denied') return <div className="wrap"><div className="err">{err}</div></div>

  return <div className="wrap wide">
    <div className="spread" style={{ marginBottom: 14 }}>
      <h1>Platform admin</h1>
      <button className="btn slim" onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}>Log out</button>
    </div>
    {msg && <div className="ok sm">{msg}</div>}
    {err && <div className="err sm">{err}</div>}
    <div className="card">
      <h2>Restaurants ({rests.length})</h2>
      {rests.map(r => <div key={r.id} className="spread sm" style={{ padding: '8px 0', borderBottom: '1px solid #F1ECE1' }}>
        <span><b>{r.name}</b> <span className="muted">/{r.slug}</span></span>
        <span className="chip">{counts[r.id] || 0} customers</span>
      </div>)}
      <h3 style={{ marginTop: 16 }}>Add restaurant</h3>
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
