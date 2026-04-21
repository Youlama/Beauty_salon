import { useEffect, useState } from 'react'
import { coreApi } from '../api'
import { useAuth } from '../App'

const G = { gold: '#D4A853', border: '#1e1e1e', cardBg: '#161616', textMuted: '#666', textSub: '#aaa' }
const STATUS_COLORS: Record<string, string> = {
  pending: '#FFA726', confirmed: '#66BB6A', completed: '#42A5F5', cancelled: '#EF5350'
}

export default function MasterPage() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState<any[]>([])
  const [today] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => { coreApi.appointments().then(setAppointments).catch(console.error) }, [])

  const upcoming = appointments.filter(a => a.date >= today && a.status !== 'cancelled')
  const past = appointments.filter(a => a.date < today || a.status === 'completed')

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, color: '#e8e8e8', marginBottom: 6 }}>
        Кабинет мастера
      </h1>
      <p style={{ color: G.textMuted, fontSize: 13, marginBottom: 32 }}>{user?.name}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, color: '#d0d0d0', marginBottom: 16,
            fontFamily: "'Cormorant Garamond', serif" }}>Предстоящие записи</h2>
          {upcoming.length === 0
            ? <p style={{ color: G.textMuted }}>Нет предстоящих записей</p>
            : upcoming.map(a => (
              <div key={a.id} style={{ background: G.cardBg, borderRadius: 12, padding: 18,
                border: `1px solid ${G.border}`, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0' }}>
                    {a.date} · {a.time_slot?.slice(0,5)}
                  </span>
                  <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 12,
                    background: `${STATUS_COLORS[a.status]}18`, color: STATUS_COLORS[a.status] }}>
                    {a.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#ccc' }}>{a.service_icon} {a.service_name}</div>
                <div style={{ fontSize: 12, color: G.textMuted, marginTop: 4 }}>
                  Клиент: {a.client_name} · {Number(a.total_price).toLocaleString('ru')} ₽
                </div>
                {a.status === 'confirmed' && (
                  <button onClick={() => coreApi.updateStatus(a.id, 'completed').then(() => coreApi.appointments().then(setAppointments))}
                    style={{ marginTop: 10, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                      border: '1px solid #42A5F5', background: 'transparent', color: '#42A5F5' }}>
                    Отметить выполненным
                  </button>
                )}
              </div>
            ))}
        </div>

        <div>
          <h2 style={{ fontSize: 18, color: '#d0d0d0', marginBottom: 16,
            fontFamily: "'Cormorant Garamond', serif" }}>Статистика</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Предстоящих', value: upcoming.length, color: G.gold },
              { label: 'Завершённых', value: past.filter(a => a.status === 'completed').length, color: '#66BB6A' },
              { label: 'Всего записей', value: appointments.length, color: '#42A5F5' },
            ].map((s, i) => (
              <div key={i} style={{ background: G.cardBg, borderRadius: 10, padding: 16, border: `1px solid ${G.border}` }}>
                <div style={{ fontSize: 11, color: G.textMuted }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: "'Cormorant Garamond', serif" }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
