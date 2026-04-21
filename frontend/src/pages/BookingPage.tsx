import { useEffect, useState } from 'react'
import { coreApi, mlApi } from '../api'
import { useAuth } from '../App'
import type { Service, Master } from '../types'

const G = { gold: '#D4A853', border: '#1e1e1e', cardBg: '#161616', textMuted: '#666', textSub: '#aaa' }
const inp: React.CSSProperties = {
  background: '#1a1a1a', border: `1px solid #2a2a2a`, borderRadius: 8,
  padding: '10px 14px', color: '#d0d0d0', fontSize: 13, width: '100%', fontFamily: 'inherit'
}
const TIMES = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30',
  '13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00']

export default function BookingPage({ setPage }: { setPage(p: string): void }) {
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [services, setServices] = useState<Service[]>([])
  const [masters, setMasters] = useState<Master[]>([])
  const [crossSell, setCrossSell] = useState<Service[]>([])
  const [schedule, setSchedule] = useState<{master_id: number; booked_slots: string[]}[]>([])
  const [form, setForm] = useState({ service_id: 0, master_id: 0, date: '', time_slot: '' })
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { coreApi.services().then(setServices).catch(console.error) }, [])
  useEffect(() => { coreApi.masters().then(setMasters).catch(console.error) }, [])
  useEffect(() => {
    if (form.master_id && form.date)
      coreApi.schedule(form.date).then(setSchedule).catch(console.error)
  }, [form.master_id, form.date])
  useEffect(() => {
    if (form.service_id)
      mlApi.crossSell(form.service_id).then(setCrossSell).catch(console.error)
  }, [form.service_id])

  if (!user) return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: G.textMuted }}>
      <p style={{ marginBottom: 16 }}>Войдите, чтобы сделать запись</p>
      <button onClick={() => setPage('login')}
        style={{ padding: '10px 24px', borderRadius: 8, border: 'none',
          background: `linear-gradient(135deg, ${G.gold}, #a67c30)`, color: '#0f0f0f', cursor: 'pointer', fontFamily: 'inherit' }}>
        Войти
      </button>
    </div>
  )

  if (done) return (
    <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: '#e8e8e8', marginBottom: 12 }}>Запись создана!</h2>
      <p style={{ color: G.textMuted, marginBottom: 24 }}>Детали записи доступны в личном кабинете.</p>
      <button onClick={() => { setDone(false); setStep(1); setForm({ service_id: 0, master_id: 0, date: '', time_slot: '' }) }}
        style={{ padding: '10px 24px', borderRadius: 8, border: 'none',
          background: `linear-gradient(135deg, ${G.gold}, #a67c30)`, color: '#0f0f0f', cursor: 'pointer', fontFamily: 'inherit' }}>
        Записаться ещё раз
      </button>
    </div>
  )

  const selectedSvc = services.find(s => s.id === form.service_id)
  const selectedMaster = masters.find(m => m.id === form.master_id)
  const bookedForMaster = schedule.find(s => s.master_id === form.master_id)?.booked_slots || []

  const submit = async () => {
    setError('')
    try {
      await coreApi.createAppt(form)
      setDone(true)
    } catch (e: any) { setError(e.message) }
  }

  const steps = ['Услуга', 'Мастер', 'Дата и время', 'Подтверждение']

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, color: '#e8e8e8', marginBottom: 24 }}>Запись на услугу</h1>

      {/* Steps */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 32 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12, fontWeight: 700,
                background: i + 1 <= step ? `linear-gradient(135deg, ${G.gold}, #a67c30)` : '#222',
                color: i + 1 <= step ? '#0f0f0f' : G.textMuted }}>
                {i + 1 <= step ? (i + 1 < step ? '✓' : i + 1) : i + 1}
              </div>
              <span style={{ fontSize: 11, color: i + 1 === step ? G.gold : G.textMuted, whiteSpace: 'nowrap' }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: i + 1 < step ? G.gold : '#222', marginBottom: 20 }} />}
          </div>
        ))}
      </div>

      <div style={{ background: G.cardBg, borderRadius: 14, padding: 28, border: `1px solid ${G.border}` }}>
        {/* Step 1: Service */}
        {step === 1 && (
          <div>
            <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>Выберите услугу</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {services.map(s => (
                <button key={s.id} onClick={() => { setForm({...form, service_id: s.id}); setStep(2) }}
                  style={{ padding: '14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    border: `1px solid ${form.service_id === s.id ? G.gold : '#2a2a2a'}`,
                    background: form.service_id === s.id ? 'rgba(212,168,83,0.08)' : '#1a1a1a', color: '#ccc' }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: G.gold, marginTop: 4 }}>{Number(s.price).toLocaleString('ru')} ₽ · {s.duration} мин</div>
                </button>
              ))}
            </div>
            {crossSell.length > 0 && form.service_id > 0 && (
              <div style={{ marginTop: 20, padding: 16, background: '#1a1a1a', borderRadius: 10, borderLeft: `3px solid ${G.gold}` }}>
                <div style={{ fontSize: 12, color: G.gold, marginBottom: 10 }}>✦ Часто заказывают вместе:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {crossSell.map((s: any) => (
                    <span key={s.service_id} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 12,
                      background: 'rgba(212,168,83,0.1)', color: G.gold }}>
                      {s.icon} {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Master */}
        {step === 2 && (
          <div>
            <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>Выберите мастера</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {masters.filter(m => selectedSvc && m.specialties.includes(selectedSvc.category)).map(m => (
                <button key={m.id} onClick={() => { setForm({...form, master_id: m.id}); setStep(3) }}
                  style={{ padding: '16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    border: `1px solid ${form.master_id === m.id ? G.gold : '#2a2a2a'}`,
                    background: form.master_id === m.id ? 'rgba(212,168,83,0.08)' : '#1a1a1a',
                    display: 'flex', alignItems: 'center', gap: 14, color: '#ccc' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${G.gold}, #a67c30)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: '#0f0f0f', flexShrink: 0 }}>
                    {m.name.split(' ').map((w: string) => w[0]).join('')}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: G.gold }}>{'★'.repeat(Math.round(Number(m.rating)))} {m.rating}</div>
                  </div>
                </button>
              ))}
              {masters.filter(m => selectedSvc && m.specialties.includes(selectedSvc.category)).length === 0 && (
                <p style={{ color: G.textMuted }}>Нет доступных мастеров для выбранной услуги</p>
              )}
            </div>
            <button onClick={() => setStep(1)} style={{ marginTop: 16, background: 'none', border: 'none',
              color: G.textMuted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>← Назад</button>
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === 3 && (
          <div>
            <h3 style={{ color: '#e0e0e0', marginBottom: 16 }}>Выберите дату и время</h3>
            <input style={{ ...inp, marginBottom: 16 }} type="date"
              min={new Date().toISOString().slice(0,10)}
              value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
            {form.date && (
              <div>
                <div style={{ fontSize: 12, color: G.textMuted, marginBottom: 12 }}>Доступное время:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {TIMES.map(t => {
                    const busy = bookedForMaster.includes(t)
                    return (
                      <button key={t} disabled={busy} onClick={() => { setForm({...form, time_slot: t}); setStep(4) }}
                        style={{ padding: '9px', borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer',
                          fontSize: 13, fontFamily: 'inherit',
                          border: `1px solid ${form.time_slot === t ? G.gold : busy ? '#1a1a1a' : '#2a2a2a'}`,
                          background: busy ? '#111' : form.time_slot === t ? 'rgba(212,168,83,0.1)' : '#1a1a1a',
                          color: busy ? '#333' : form.time_slot === t ? G.gold : '#ccc',
                          textDecoration: busy ? 'line-through' : 'none' }}>
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <button onClick={() => setStep(2)} style={{ marginTop: 16, background: 'none', border: 'none',
              color: G.textMuted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>← Назад</button>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div>
            <h3 style={{ color: '#e0e0e0', marginBottom: 20 }}>Подтверждение записи</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Услуга', value: selectedSvc?.name },
                { label: 'Мастер', value: selectedMaster?.name },
                { label: 'Дата', value: form.date },
                { label: 'Время', value: form.time_slot },
                { label: 'Стоимость', value: selectedSvc ? `${Number(selectedSvc.price).toLocaleString('ru')} ₽` : '' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0',
                  borderBottom: `1px solid ${G.border}` }}>
                  <span style={{ fontSize: 13, color: G.textMuted }}>{row.label}</span>
                  <span style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
            </div>
            {error && <p style={{ color: '#EF5350', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button onClick={submit}
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg, ${G.gold}, #a67c30)`, color: '#0f0f0f',
                fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
              Подтвердить запись
            </button>
            <button onClick={() => setStep(3)} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none',
              color: G.textMuted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>← Изменить время</button>
          </div>
        )}
      </div>
    </div>
  )
}
