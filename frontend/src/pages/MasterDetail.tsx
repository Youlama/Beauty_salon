import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { mastersApi } from '../api';
import type { Master } from '../types';

const S: Record<string, React.CSSProperties> = {
  wrap:    { maxWidth:900, margin:'0 auto', padding:'48px 40px' },
  header:  { display:'flex', gap:32, marginBottom:48, alignItems:'flex-start' },
  avatar:  { width:96, height:96, borderRadius:'50%', background:'linear-gradient(135deg,#D4A853,#a67c30)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, fontWeight:700, color:'#0f0f0f', flexShrink:0 },
  name:    { fontFamily:"'Cormorant Garamond',serif", fontSize:32, color:'#e8e8e8', marginBottom:6 },
  rating:  { color:'#D4A853', fontSize:16, marginBottom:8 },
  bio:     { color:'#aaa', fontSize:14, lineHeight:1.7 },
  section: { marginBottom:40 },
  stitle:  { fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:'#d0d0d0', marginBottom:16, paddingBottom:8, borderBottom:'1px solid #1e1e1e' },
  svcGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  svcCard: { background:'#141414', border:'1px solid #1e1e1e', borderRadius:10, padding:16, display:'flex', justifyContent:'space-between', alignItems:'center' },
  svcName: { fontSize:14, color:'#ccc' },
  svcPrice:{ color:'#D4A853', fontWeight:600 },
  revCard: { background:'#141414', border:'1px solid #1e1e1e', borderRadius:10, padding:16, marginBottom:10 },
  revStars:{ color:'#D4A853', fontSize:14, marginBottom:6 },
  revText: { color:'#aaa', fontSize:13, lineHeight:1.6, marginBottom:6 },
  revAuth: { color:'#555', fontSize:12 },
  bookBtn: { display:'inline-block', padding:'12px 32px', background:'linear-gradient(135deg,#D4A853,#a67c30)', color:'#0f0f0f', borderRadius:8, textDecoration:'none', fontWeight:600, fontSize:14 },
};

export default function MasterDetail() {
  const { id } = useParams<{ id: string }>();
  const [master, setMaster] = useState<Master | null>(null);

  useEffect(() => {
    if (id) mastersApi.get(Number(id)).then(setMaster).catch(() => {});
  }, [id]);

  if (!master) return <div style={{ padding:60, textAlign:'center', color:'#666' }}>Загрузка...</div>;

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={S.avatar}>{master.name.split(' ').map(w => w[0]).join('')}</div>
        <div>
          <div style={S.name}>{master.name}</div>
          <div style={S.rating}>{'★'.repeat(Math.round(master.rating))} {master.rating}</div>
          {master.bio && <p style={S.bio}>{master.bio}</p>}
          <div style={{ marginTop:16 }}>
            <Link to={`/booking?master_id=${master.id}`} style={S.bookBtn}>Записаться к мастеру</Link>
          </div>
        </div>
      </div>

      {master.services && master.services.length > 0 && (
        <div style={S.section}>
          <h3 style={S.stitle}>Услуги</h3>
          <div style={S.svcGrid}>
            {master.services.map(s => (
              <div key={s.id} style={S.svcCard}>
                <span style={S.svcName}>{s.icon} {s.name}</span>
                <span style={S.svcPrice}>{(s as any).effective_price?.toLocaleString() ?? s.price.toLocaleString()}₽</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {master.reviews && master.reviews.length > 0 && (
        <div style={S.section}>
          <h3 style={S.stitle}>Отзывы</h3>
          {master.reviews.map((r: any, i: number) => (
            <div key={i} style={S.revCard}>
              <div style={S.revStars}>{'★'.repeat(r.rating)}</div>
              <p style={S.revText}>{r.text}</p>
              <div style={S.revAuth}>{r.author_name} · {r.service_name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
