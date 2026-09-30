'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { errMsg } from '../../lib/helpers'

export default function Login() {
  const r = useRouter()
  const [mode, setMode] = useState('in') // in | owner | staff | create
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
  const [name, setName] = useState(''); const [slug, setSlug] = useState('')
  const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)

  async function route() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ru } = await supabase.from('restaurant_users').select('role').eq('user_id', user.id).limit(1)
    if (ru?.length) return r.replace(ru[0].role === 'staff' ? '/staff' : '/admin')
    const { data: pa } = await supabase.from('platform_admins').select('user_id').eq('user_id', user.id)
    if (pa?.length) return r.replace('/super')
    setMsg('No restaurant linked to this account. Owners: create yours below. Staff: ask your manager to add your email under Admin > Staff.')
    setMode('create')
  }

  async function signIn(e) {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
    setBusy(false); if (error) return setErr(errMsg(error)); route()
  }
  async function signUpOwner(e) {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('')
    const { error } = await supabase.auth.signUp({ email, password: pw })
    if (error) { setBusy(false); return setErr(errMsg(error)) }
    const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '')
    const { error: e2 } = await supabase.rpc('create_restaurant', { p_name: name, p_slug: clean })
    if (e2) { setBusy(false); return setErr(errMsg(e2)) }
    r.replace('/admin')
  }
  async function signUpStaff(e) {
    e.preventDefault(); setBusy(true); setErr(''); setMsg('')
    const { error } = await supabase.auth.signUp({ email, password: pw })
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setMsg('Login created. Now ask your manager to add "' + email + '" under Admin > Staff, then sign in.')
    setMode('in')
  }
  async function createResto(e) {
    e.preventDefault(); setBusy(true); setErr('')
    const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '')
    const { error } = await supabase.rpc('create_restaurant', { p_name: name, p_slug: clean })
    setBusy(false); if (error) return setErr(errMsg(error))
    r.replace('/admin')
  }

  return <div className="wrap" style={{ paddingTop: 40 }}>
    <div style={{ textAlign: 'center', marginBottom: 20 }}>
      <div style={{ fontWeight: 800, fontSize: 24, color: '#C2511F' }}>Tessera</div>
      <div className="muted sm">Loyalty & offers for restaurants</div>
    </div>
    <div className="card">
      <div className="tabs">
        <button className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>Sign in</button>
        <button className={mode === 'owner' ? 'on' : ''} onClick={() => setMode('owner')}>Owner sign-up</button>
        <button className={mode === 'staff' ? 'on' : ''} onClick={() => setMode('staff')}>Staff sign-up</button>
      </div>
      {err && <div className="err sm">{err}</div>}
      {msg && <div className="ok sm">{msg}</div>}
      {mode === 'in' && <form onSubmit={signIn}>
        <label className="label">Email</label>
        <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <label className="label">Password</label>
        <input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} required />
        <div style={{ height: 16 }} />
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>}
      {mode === 'owner' && <form onSubmit={signUpOwner}>
        <label className="label">Restaurant name</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} required />
        <label className="label">Web name (letters/numbers only)</label>
        <input className="input" value={slug} onChange={e => setSlug(e.target.value)} placeholder="blueorchid" required />
        <label className="label">Your email</label>
        <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <label className="label">Password (8+ characters)</label>
        <input className="input" type="password" minLength={8} value={pw} onChange={e => setPw(e.target.value)} required />
        <div style={{ height: 16 }} />
        <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create my restaurant'}</button>
      </form>}
      {mode === 'staff' && <form onSubmit={signUpStaff}>
        <label className="label">Your email</label>
        <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <label className="label">Password (8+ characters)</label>
        <input className="input" type="password" minLength={8} value={pw} onChange={e => setPw(e.target.value)} required />
        <div style={{ height: 16 }} />
        <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create my login'}</button>
      </form>}
      {mode === 'create' && <form onSubmit={createResto}>
        <label className="label">Restaurant name</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} required />
        <label className="label">Web name</label>
        <input className="input" value={slug} onChange={e => setSlug(e.target.value)} required />
        <div style={{ height: 16 }} />
        <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create restaurant'}</button>
      </form>}
    </div>
    <p className="muted sm" style={{ textAlign: 'center' }}>
      Customer? Open the loyalty link your restaurant gave you — no login needed.
    </p>
  </div>
}
