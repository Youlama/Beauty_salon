import { useEffect, useState } from 'react'
import { coreApi } from '../api'
import type { SalonInfo, Review } from '../types'

const G = { gold: '#D4A853', border: '#1e1e1e', cardBg: '#161616', textMuted: '#666', textSub: '#aaa' }

export default function HomePage({ setPage }: { setPage(p: string): void }) {
  const [info, setInfo] = useState<SalonInfo | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])

  useEffect(() => {
    coreApi.salonInfo().then(setInfo).catch(console.error)
    coreApi.reviews().then(r => setReviews(r.slice(0, 4))).catch(console.error)
  }, [])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 20px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 80 }}>
        <div style={{ fontSize: 14, color: G.gold, letterSpacing: '0.2em', marginBottom: 16 }}>
          — ДОБРО ПОЖАЛОВАТЬ —
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 64, fontWeight: 600,
          color: '#e8e8e8', lineHeight: 1.1, marginBottom: 24 }}>
          Belle<br />Salon
        </h1>
        <p style={{ fontSize: 16, color: G.textSub, maxWidth: 480, margin: '0 auto 36px' }}>
          Салон красоты полного цикла в сердце Москвы. Профессиональные мастера, персональный подход, результат, который вас порадует.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => setPage('booking')}
            style={{ padding: '12px 32px', borderRadius: 8, border: 'none',
              background: `linear-gradient(135deg, ${G.gold}, #a67c30)`,
              color: '#0f0f0f', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Записаться
          </button>
          <button onClick={() => setPage('services')}
            style={{ padding: '12px 32px', borderRadius: 8, border: `1px solid ${G.border}`,
              background: 'transparent', color: '#ccc', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Услуги и цены
          </button>
        </div>
      </div>

      {/* Salon info */}
      {info && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 60 }}>
          {[
            { icon: '📍', label: 'Адрес', value: info.address },
            { icon: '🕐', label: 'Часы работы', value: info.hours },
            { icon: '📞', label: 'Телефон', value: info.phone },
          ].map((c, i) => (
            <div key={i} style={{ background: G.cardBg, borderRadius: 12, padding: 24, border: `1px solid ${G.border}` }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{c.icon}</div>
              <div style={{ fontSize: 11, color: G.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.label}</div>
              <div style={{ fontSize: 14, color: '#ccc' }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, color: '#e8e8e8', marginBottom: 24 }}>
            Отзывы клиентов
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {reviews.map(r => (
              <div key={r.id} style={{ background: G.cardBg, borderRadius: 12, padding: 20, border: `1px solid ${G.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 600, color: '#d0d0d0', fontSize: 14 }}>{r.author_name}</span>
                  <span style={{ color: G.gold, fontSize: 14 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                </div>
                <p style={{ fontSize: 13, color: G.textSub, lineHeight: 1.6 }}>{r.text}</p>
                {r.admin_reply && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#1a1a1a', borderRadius: 8,
                    borderLeft: `3px solid ${G.gold}`, fontSize: 12, color: G.textMuted }}>
                    <strong style={{ color: G.gold }}>Ответ салона:</strong> {r.admin_reply}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
