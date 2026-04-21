import { useState } from 'react'
import { authApi } from '../api'
import type { User } from '../types'

const G = { gold: '#D4A853', border: '#1e1e1e', cardBg: '#141414', textMuted: '#666' }
const inp: React.CSSProperties = {
  background: '#1a1a1a', border: `1px solid #2a2a2a`, borderRadius: 8,
  padding: '10px 14px', color: '#d0d0d0', fontSize: 13, width: '100%', outline: 'none',
  fontFamily: 'inherit'
}
const btn: React.CSSProperties = {
  width: '100%', padding: '11px', borderRadius: 8, border: 'none',
  background: `linear-gradient(135deg, ${G.gold}, #a67c30)`,
  color: '#0f0f0f', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
}

export default function LoginPage({ onSuccess, setPage }: { onSuccess(t: string, u: User): void; setPage(p: string): void }) {
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'client' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.email || !form.password) { setError('Заполните все поля'); return }
    setLoading(true); setError('')
    try {
      const data = await (mode === 'login'
        ? authApi.login({ email: form.email, password: form.password })
        : authApi.register(form))
      onSuccess(data.access_token, data.user)
    } catch(e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 400, background: G.cardBg, borderRadius: 16, padding: 36, border: `1px solid ${G.border}` }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 30, color: G.gold }}>✦</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: '#e8e8e8', margin: '8px 0 4px' }}>
            BELLE SALON
          </h1>
          <p style={{ fontSize: 12, color: G.textMuted }}>Войдите или создайте аккаунт</p>
        </div>

        <div style={{ display: 'flex', border: `1px solid #2a2a2a`, borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
          {(['login','register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }}
              style={{ flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                background: mode === m ? 'rgba(212,168,83,0.1)' : 'transparent',
                color: mode === m ? G.gold : G.textMuted }}>
              {m === 'login' ? 'Вход' : 'Регистрация'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && <>
            <input style={inp} placeholder="Имя" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <input style={inp} placeholder="Телефон" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          </>}
          <input style={inp} placeholder="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <input style={inp} placeholder="Пароль" type="password" value={form.password}
            onChange={e => setForm({...form, password: e.target.value})}
            onKeyDown={e => e.key === 'Enter' && submit()} />

          {mode === 'register' && (
            <div style={{ display: 'flex', gap: 8 }}>
              {[{v:'client',l:'Клиент'},{v:'master',l:'Мастер'}].map(r => (
                <button key={r.v} onClick={() => setForm({...form, role: r.v})}
                  style={{ flex: 1, padding: '8px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                    border: `1px solid ${form.role === r.v ? G.gold : '#2a2a2a'}`,
                    background: form.role === r.v ? 'rgba(212,168,83,0.1)' : 'transparent',
                    color: form.role === r.v ? G.gold : G.textMuted }}>
                  {r.l}
                </button>
              ))}
            </div>
          )}

          {error && <p style={{ color: '#EF5350', fontSize: 12, textAlign: 'center' }}>{error}</p>}
          <button style={{ ...btn, opacity: loading ? 0.6 : 1 }} onClick={submit} disabled={loading}>
            {loading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
          <p style={{ fontSize: 11, color: '#444', textAlign: 'center' }}>
            Тест: admin@salon.ru / test1234
          </p>
        </div>
      </div>
    </div>
  )
}
