import { useEffect, useState } from 'react'
import { coreApi } from '../api'
import { useAuth } from '../App'
import type { Appointment } from '../types'

const G = { gold: '#D4A853', border: '#1e1e1e', cardBg: '#161616', textMuted: '#666' }
const STATUS = {
  pending: { l:'Ожидает', c:'#FFA726' }, confirmed: { l:'Подтверждено', c:'#66BB6A' },
  completed: { l:'Выполнено', c:'#42A5F5' }, cancelled: { l:'Отменено', c:'#EF5350' }
}

export default function ProfilePage({ setPage }: { setPage(p: string): void }) {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [tab, setTab] = useState<'upcoming'|'history'>('upcoming')
  const [reviewForm, setReviewForm] = useState<{appt_id: number; rating: number; text: string} | null>(null)

  const load = () => coreApi.appointments().then(setAppointments).catch(console.error)
  useEffect(() => { load() }, [])

  const now = new Date().toISOString().slice(0, 10)
  const upcoming = appointments.filter(a => a.date >= now && a.status !== 'cancelled')
  const history = appointments.filter(a => a.date < now || a.status === 'completed')

  const cancel = async (id: number) => {
    await coreApi.updateStatus(id, 'cancelled')
    load()
  }

  const submitReview = async () => {
    if (!reviewForm) return
    await coreApi.createReview({ appointment_id: reviewForm.appt_id, rating: reviewForm.rating, text: reviewForm.text })
    setReviewForm(null)
    alert('Отзыв отправлен на модерацию')
  }

  const shown = tab === 'upcoming' ? upcoming : history

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, color: '#e8e8e8', marginBottom: 6 }}>
        Личный кабинет
      </h1>
      <p style={{ color: G.textMuted, fontSize: 13, marginBottom: 28 }}>Привет, {user?.name}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[{v:'upcoming',l:'Предстоящие'},{v:'history',l:'История посещений'}].map(t => (
          <button key={t.v} onClick={() => setTab(t.v as 'upcoming'|'history')}
            style={{ padding: '8px 18px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
              border: `1px solid ${tab === t.v ? G.gold : '#2a2a2a'}`,
              background: tab === t.v ? 'rgba(212,168,83,0.1)' : 'transparent',
              color: tab === t.v ? G.gold : G.textMuted }}>
            {t.l} {t.v === 'upcoming' ? `(${upcoming.length})` : `(${history.length})`}
          </button>
        ))}
        <button onClick={() => setPage('booking')}
          style={{ marginLeft: 'auto', padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${G.gold}, #a67c30)`, color: '#0f0f0f', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>
          + Новая запись
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {shown.length === 0 && <p style={{ color: G.textMuted, textAlign: 'center', padding: 40 }}>Нет записей</p>}
        {shown.map(a => {
          const st = STATUS[a.status] || STATUS.pending
          return (
            <div key={a.id} style={{ background: G.cardBg, borderRadius: 12, padding: 20, border: `1px solid ${G.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0' }}>{a.service_icon} {a.service_name}</div>
                  <div style={{ fontSize: 13, color: G.textMuted, marginTop: 4 }}>
                    {a.master_name} · {a.date} · {a.time_slot?.slice(0,5)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: G.gold }}>{Number(a.total_price).toLocaleString('ru')} ₽</span>
                  <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 12,
                    background: `${st.c}18`, color: st.c }}>{st.l}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {a.status === 'pending' || a.status === 'confirmed' ? (
                  <button onClick={() => cancel(a.id)}
                    style={{ padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                      border: '1px solid #EF5350', background: 'transparent', color: '#EF5350' }}>
                    Отменить
                  </button>
                ) : null}
                {a.status === 'completed' && (
                  <button onClick={() => setReviewForm({ appt_id: a.id, rating: 5, text: '' })}
                    style={{ padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                      border: `1px solid ${G.gold}`, background: 'transparent', color: G.gold }}>
                    Оставить отзыв
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Review modal */}
      {reviewForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: G.cardBg, borderRadius: 14, padding: 32, width: 420, border: `1px solid ${G.border}` }}>
            <h3 style={{ color: '#e0e0e0', marginBottom: 20 }}>Оставить отзыв</h3>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[1,2,3,4,5].map(s => (
                <span key={s} onClick={() => setReviewForm({...reviewForm, rating: s})}
                  style={{ fontSize: 28, cursor: 'pointer', color: s <= reviewForm.rating ? G.gold : '#333' }}>★</span>
              ))}
            </div>
            <textarea value={reviewForm.text}
              onChange={e => setReviewForm({...reviewForm, text: e.target.value})}
              placeholder="Напишите ваш отзыв..."
              style={{ width: '100%', minHeight: 100, background: '#1a1a1a', border: `1px solid #2a2a2a`,
                borderRadius: 8, padding: '10px 14px', color: '#d0d0d0', fontSize: 13, fontFamily: 'inherit',
                resize: 'vertical', outline: 'none' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={submitReview}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg, ${G.gold}, #a67c30)`, color: '#0f0f0f', fontFamily: 'inherit', fontWeight: 600 }}>
                Отправить
              </button>
              <button onClick={() => setReviewForm(null)}
                style={{ padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${G.border}`, background: 'transparent', color: G.textMuted }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
