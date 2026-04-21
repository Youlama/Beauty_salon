import { useEffect, useState } from 'react'
import { coreApi } from '../api'
import { useAuth } from '../App'
import type { Service } from '../types'

const G = { gold: '#D4A853', border: '#1e1e1e', cardBg: '#161616', textMuted: '#666' }
const CATS = [
  { v: '', l: 'Все' }, { v: 'hair', l: 'Волосы' }, { v: 'nails', l: 'Ногти' },
  { v: 'face', l: 'Лицо' }, { v: 'body', l: 'Тело' }
]

export default function ServicesPage({ setPage }: { setPage(p: string): void }) {
  const { user } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [cat, setCat] = useState('')

  useEffect(() => { coreApi.services(cat || undefined).then(setServices).catch(console.error) }, [cat])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, color: '#e8e8e8', marginBottom: 6 }}>Каталог услуг</h1>
      <p style={{ color: G.textMuted, fontSize: 13, marginBottom: 28 }}>Полный перечень услуг с ценами и длительностью</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {CATS.map(c => (
          <button key={c.v} onClick={() => setCat(c.v)}
            style={{ padding: '7px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
              border: `1px solid ${cat === c.v ? G.gold : '#2a2a2a'}`,
              background: cat === c.v ? 'rgba(212,168,83,0.1)' : 'transparent',
              color: cat === c.v ? G.gold : G.textMuted }}>
            {c.l}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {services.map(s => (
          <div key={s.id} style={{ background: G.cardBg, borderRadius: 12, padding: 20, border: `1px solid ${G.border}` }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{s.icon}</div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', marginBottom: 8 }}>{s.name}</h3>
            <div style={{ display: 'flex', gap: 20, marginBottom: 16, paddingTop: 12, borderTop: `1px solid ${G.border}` }}>
              <div>
                <div style={{ fontSize: 10, color: G.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Длительность</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#ccc', marginTop: 3 }}>{s.duration} мин</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: G.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Стоимость</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: G.gold, marginTop: 3 }}>{Number(s.price).toLocaleString('ru')} ₽</div>
              </div>
            </div>
            <button onClick={() => setPage(user ? 'booking' : 'login')}
              style={{ width: '100%', padding: '9px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
                fontFamily: 'inherit', fontWeight: 600,
                background: `linear-gradient(135deg, ${G.gold}, #a67c30)`, color: '#0f0f0f' }}>
              Записаться
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
