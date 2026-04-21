import { useEffect, useState } from 'react'
import { coreApi, analyticsApi } from '../api'

const G = { gold: '#D4A853', border: '#1e1e1e', cardBg: '#161616', textMuted: '#666', textSub: '#aaa' }
const inp: React.CSSProperties = {
  background: '#1a1a1a', border: `1px solid #2a2a2a`, borderRadius: 8,
  padding: '9px 14px', color: '#d0d0d0', fontSize: 13, fontFamily: 'inherit'
}

export default function AdminPage() {
  const [tab, setTab] = useState('appointments')
  const [appointments, setAppointments] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [pendingReviews, setPendingReviews] = useState<any[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [forecast, setForecast] = useState<any[]>([])

  useEffect(() => {
    coreApi.appointments().then(setAppointments).catch(console.error)
    coreApi.services().then(setServices).catch(console.error)
    coreApi.pendingReviews().then(setPendingReviews).catch(console.error)
  }, [])

  useEffect(() => {
    if (tab === 'analytics') {
      const to = new Date().toISOString().slice(0,10)
      const from = new Date(Date.now() - 30*86400000).toISOString().slice(0,10)
      analyticsApi.revenue(from, to).then(setAnalytics).catch(console.error)
      analyticsApi.forecast().then(setForecast).catch(console.error)
    }
  }, [tab])

  const STATUS_COLORS: Record<string, string> = {
    pending: '#FFA726', confirmed: '#66BB6A', completed: '#42A5F5', cancelled: '#EF5350'
  }
  const tabs = [
    { v:'appointments', l:'Записи' }, { v:'services', l:'Услуги' },
    { v:'reviews', l:`Отзывы (${pendingReviews.length})` }, { v:'analytics', l:'Аналитика' }
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, color: '#e8e8e8', marginBottom: 24 }}>
        Панель администратора
      </h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            style={{ padding: '8px 18px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
              border: `1px solid ${tab === t.v ? G.gold : '#2a2a2a'}`,
              background: tab === t.v ? 'rgba(212,168,83,0.1)' : 'transparent',
              color: tab === t.v ? G.gold : G.textMuted }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Appointments */}
      {tab === 'appointments' && (
        <div style={{ background: G.cardBg, borderRadius: 12, border: `1px solid ${G.border}`, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Клиент','Услуга','Мастер','Дата','Время','Статус','Действия'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                  color: G.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em',
                  borderBottom: `1px solid ${G.border}` }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {appointments.map(a => (
                <tr key={a.id} style={{ borderBottom: `1px solid #1a1a1a` }}>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{a.client_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{a.service_icon} {a.service_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{a.master_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{a.date}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{a.time_slot?.slice(0,5)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 12,
                      background: `${STATUS_COLORS[a.status]}18`, color: STATUS_COLORS[a.status] }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {a.status === 'pending' && (
                      <button onClick={() => coreApi.updateStatus(a.id, 'confirmed').then(() => coreApi.appointments().then(setAppointments))}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                          border: '1px solid #66BB6A', background: 'transparent', color: '#66BB6A', fontFamily: 'inherit' }}>
                        Подтвердить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Services */}
      {tab === 'services' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {services.map(s => (
              <div key={s.id} style={{ background: G.cardBg, borderRadius: 12, padding: 18, border: `1px solid ${G.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: G.gold, marginTop: 4 }}>{Number(s.price).toLocaleString('ru')} ₽ · {s.duration} мин</div>
                  </div>
                  <button onClick={() => coreApi.updateService(s.id, { archived: !s.archived })
                    .then(() => coreApi.services().then(setServices))}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${s.archived ? '#66BB6A' : '#EF5350'}`,
                      background: 'transparent', color: s.archived ? '#66BB6A' : '#EF5350' }}>
                    {s.archived ? 'Восстановить' : 'Архивировать'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews moderation */}
      {tab === 'reviews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendingReviews.length === 0 && <p style={{ color: G.textMuted, textAlign: 'center', padding: 40 }}>Нет отзывов для проверки</p>}
          {pendingReviews.map((r: any) => (
            <div key={r.id} style={{ background: G.cardBg, borderRadius: 12, padding: 20, border: `1px solid ${G.border}`,
              borderLeft: r.priority ? '3px solid #EF5350' : `3px solid ${G.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#d0d0d0' }}>{r.author_name}</span>
                  <span style={{ fontSize: 12, color: G.textMuted, marginLeft: 10 }}>{r.service_name} · {r.master_name}</span>
                  {r.priority && <span style={{ marginLeft: 8, fontSize: 11, color: '#EF5350' }}>⚠ Негативный</span>}
                </div>
                <span style={{ color: G.gold }}>{'★'.repeat(r.rating)}</span>
              </div>
              <p style={{ fontSize: 13, color: G.textSub, marginBottom: 14 }}>{r.text}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => coreApi.moderateReview(r.id, { status: 'approved' })
                  .then(() => coreApi.pendingReviews().then(setPendingReviews))}
                  style={{ padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                    border: '1px solid #66BB6A', background: 'transparent', color: '#66BB6A' }}>
                  Одобрить
                </button>
                <button onClick={() => coreApi.moderateReview(r.id, { status: 'rejected' })
                  .then(() => coreApi.pendingReviews().then(setPendingReviews))}
                  style={{ padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                    border: '1px solid #EF5350', background: 'transparent', color: '#EF5350' }}>
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Analytics */}
      {tab === 'analytics' && (
        <div>
          {analytics && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
              {[
                { label: 'Выручка за 30 дней', value: `${Number(analytics.total_revenue).toLocaleString('ru')} ₽`, color: G.gold },
                { label: 'Записей за период', value: analytics.by_day?.reduce((s: number, d: any) => s + d.appointments, 0) || 0, color: '#42A5F5' },
                { label: 'Дней в статистике', value: analytics.by_day?.length || 0, color: '#66BB6A' },
              ].map((s, i) => (
                <div key={i} style={{ background: G.cardBg, borderRadius: 12, padding: 24, border: `1px solid ${G.border}` }}>
                  <div style={{ fontSize: 11, color: G.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: "'Cormorant Garamond', serif" }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: G.cardBg, borderRadius: 12, padding: 24, border: `1px solid ${G.border}`, marginBottom: 20 }}>
            <h3 style={{ color: '#d0d0d0', marginBottom: 16 }}>Прогноз загрузки мастеров</h3>
            {forecast.length === 0
              ? <p style={{ color: G.textMuted }}>Загрузка прогноза...</p>
              : forecast.map((m: any) => (
                <div key={m.master_id} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ccc', marginBottom: 8 }}>{m.master_name}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {m.forecast?.slice(0, 7).map((d: any) => (
                      <div key={d.date} style={{ textAlign: 'center', minWidth: 52 }}>
                        <div style={{ fontSize: 10, color: G.textMuted }}>{d.date.slice(5)}</div>
                        <div style={{ marginTop: 4, height: 40, background: '#1a1a1a', borderRadius: 4,
                          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                          paddingBottom: 4, position: 'relative' }}>
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                            height: `${Math.min(d.predicted_appointments * 20, 100)}%`,
                            background: `linear-gradient(to top, ${G.gold}, #a67c30)`, borderRadius: 4,
                            minHeight: 4 }} />
                        </div>
                        <div style={{ fontSize: 10, color: G.textMuted, marginTop: 2 }}>{d.predicted_appointments}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {['xlsx', 'pdf'].map(fmt => (
              <button key={fmt} onClick={() => analyticsApi.export(fmt).then(d => alert(d.message))}
                style={{ padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                  border: `1px solid ${G.border}`, background: 'transparent', color: G.textMuted }}>
                Экспорт {fmt.toUpperCase()} ⚠ В разработке
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
