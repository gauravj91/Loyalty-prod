'use client'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const r = useRouter()
  useEffect(() => { (async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return r.replace('/login')
    const { data: ru } = await supabase.from('restaurant_users').select('role').eq('user_id', session.user.id).limit(1)
    if (ru?.length) return r.replace(ru[0].role === 'staff' ? '/staff' : '/admin')
    const { data: pa } = await supabase.from('platform_admins').select('user_id').eq('user_id', session.user.id)
    return r.replace(pa?.length ? '/super' : '/login')
  })() }, [])
  return <div className="wrap" style={{ textAlign: 'center', paddingTop: 80 }}>
    <div style={{ fontWeight: 800, fontSize: 26, color: '#C2511F', letterSpacing: '-.02em' }}>Tessera</div>
    <p className="muted sm" style={{ marginTop: 8 }}>Loading…</p>
  </div>
}
