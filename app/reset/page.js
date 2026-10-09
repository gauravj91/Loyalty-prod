'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { errMsg } from '../../lib/helpers'

export default function Reset() {
  const [phase, setPhase] = useState('checking')
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('')
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('')

  useEffect(() => { (async () => {
    let tries = 0
    while (tries < 10) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) return setPhase('ready')
      await new Promise(r => setTimeout(r, 400)); tries++
    }
    setErr('This reset link is invalid or has expired. Please request a new one from the login page.')
    setPhase('error')
  })() }, [])

  async function save() {
    setErr(''); setMsg('')
    if (pw.length < 8) return setErr('Password must be at least 8 characters.')
    if (pw !== pw2) return setErr('Passwords do not match.')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) return setErr(errMsg(error))
    setMsg('Password updated! Redirecting to login…')
    setTimeout(() => { window.location.href = '/login' }, 1500)
  }

  return <div className="wrap" style={{ paddingTop: 50 }}>
    <div style={{ textAlign: 'center', marginBottom: 20 }}>
      <div style={{ fontWeight: 800, fontSize: 24, color: '#C2511F' }}>Tessera</div>
      <div className="muted sm">Set a new password</div>
    </div>
    <div className="card">
      {phase === 'checking' && <p className="muted sm">Checking your reset link…</p>}
      {phase === 'error' && <div className="err sm">{err}</div>}
      {phase === 'ready' && <>
        {err && <div className="err sm">{err}</div>}
        {msg && <div className="ok sm">{msg}</div>}
        <label className="label">New password</label>
        <input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} />
        <label className="label">Repeat new password</label>
        <input className="input" type="password" value={pw2} onChange={e => setPw2(e.target.value)} />
        <div style={{ height: 14 }} />
        <button className="btn primary" onClick={save}>Save new password</button>
      </>}
    </div>
  </div>
}
