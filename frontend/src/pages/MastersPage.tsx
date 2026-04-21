import { useEffect, useState } from 'react'
import { coreApi } from '../api'
import type { Master } from '../types'

const G = { gold: '#D4A853', border: '#1e1e1e', cardBg: '#161616', textMuted: '#666', textSub: '#aaa' }

export default function MastersPage({ setPage }: { setPage(p: string): void }) {
  const [masters, setMasters] = useState<Master[]>([])

  useEffect(() => { coreApi.masters().then(setMasters).catch(console.error) }, [])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, color: '#e8e8e8', marginBottom: 6 }}>Наши мастера</h1>
      <p style={{ color: G.textMuted, fontSize: 13, marginBottom: 32 }}>Профессиональные специалисты с портфолио и отзывами</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {masters.map(m => (
          <div key={m.id} style={{ background: G.cardBg, borderRadius: 14, padding: 24, border: `1px solid ${G.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%',
                background: `linear-gradient(135deg, ${G.gold}, #a67c30)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: '#0f0f0f', flexShrink: 0 }}>
                {m.name.split(' ').map((w: string) => w[0]).join('')}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0' }}>{m.name}</div>
                <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>{m.specialties}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <span style={{ color: G.gold }}>{'★'.repeat(Math.round(Number(m.rating)))}</span>
              <span style={{ fontSize: 12, color: G.textMuted }}>{m.rating} рейтинг</span>
            </div>
            {m.bio && <p style={{ fontSize: 13, color: G.textSub, lineHeight: 1.5, marginBottom: 14 }}>{m.bio}</p>}
            {m.reviews && m.reviews.length > 0 && (
              <div style={{ borderTop: `1px solid ${G.border}`, paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: G.textMuted, marginBottom: 8 }}>Последний отзыв</div>
                <p style={{ fontSize: 12, color: G.textSub, lineHeight: 1.5 }}>"{m.reviews[0].text.slice(0, 80)}..."</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
