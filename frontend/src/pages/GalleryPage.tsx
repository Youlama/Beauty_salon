import { useEffect, useState } from 'react'
import { coreApi, mlApi } from '../api'
import { useAuth } from '../App'
import type { Photo } from '../types'

const G = { gold: '#D4A853', border: '#1e1e1e', cardBg: '#161616', textMuted: '#666' }

export default function GalleryPage() {
  const { user } = useAuth()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [recs, setRecs] = useState<Photo[]>([])
  const [tab, setTab] = useState<'all'|'recs'>('all')

  useEffect(() => {
    coreApi.gallery().then(setPhotos).catch(console.error)
    if (user) mlApi.galleryRecs(user.id).then((d: any) => setRecs(d.photos || [])).catch(console.error)
  }, [user])

  const shown = tab === 'recs' ? recs : photos

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, color: '#e8e8e8', marginBottom: 6 }}>Галерея работ</h1>
      <p style={{ color: G.textMuted, fontSize: 13, marginBottom: 24 }}>Портфолио наших мастеров</p>

      {user && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[{v:'all',l:'Все работы'},{v:'recs',l:'Рекомендации для вас'}].map(t => (
            <button key={t.v} onClick={() => setTab(t.v as 'all'|'recs')}
              style={{ padding: '7px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                border: `1px solid ${tab === t.v ? G.gold : '#2a2a2a'}`,
                background: tab === t.v ? 'rgba(212,168,83,0.1)' : 'transparent',
                color: tab === t.v ? G.gold : G.textMuted }}>
              {t.l}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: G.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🖼️</div>
          <p>{tab === 'recs' ? 'Сделайте первую запись для персональных рекомендаций' : 'Фотографии пока не добавлены'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {shown.map(p => (
            <div key={p.id} style={{ background: G.cardBg, borderRadius: 12, overflow: 'hidden', border: `1px solid ${G.border}` }}>
              <div style={{ height: 200, background: '#1a1a1a', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 48 }}>
                {/* Placeholder — реальные фото из MinIO */}
                ✂️
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#ccc' }}>{p.service_name || 'Работа мастера'}</div>
                <div style={{ fontSize: 12, color: G.textMuted, marginTop: 4 }}>{p.master_name}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
