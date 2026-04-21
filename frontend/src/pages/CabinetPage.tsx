import { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { appointmentsApi, reviewsApi, mlApi } from '../api';
import type { Appointment, Review } from '../types';

const S: Record<string, React.CSSProperties> = {
  wrap:  { maxWidth:900, margin:'0 auto', padding:'48px 40px' },
  title: { fontFamily:"'Cormorant Garamond',serif", fontSize:36, color:'#e8e8e8', marginBottom:6 },
  sub:   { color:'#666', fontSize:14, marginBottom:32 },
  tabs:  { display:'flex', gap:0, borderBottom:'1px solid #1e1e1e', marginBottom:32 },
  tab:   { padding:'10px 24px', background:'transparent', border:'none', color:'#666', fontSize:13, cursor:'pointer', borderBottom:'2px solid transparent' },
  tabA:  { color:'#D4A853', borderBottomColor:'#D4A853' },
  card:  { background:'#141414', border:'1px solid #1e1e1e', borderRadius:10, padding:20, marginBottom:12 },
  row:   { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  sname: { fontSize:15, color:'#d0d0d0', fontWeight:500 },
  meta:  { fontSize:13, color:'#888', marginTop:4 },
  badge: { display:'inline-block', padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:600 },
  actions:{ display:'flex', gap:8, marginTop:12 },
  actBtn:{ padding:'7px 16px', borderRadius:6, border:'1px solid #2a2a2a', background:'transparent', color:'#aaa', fontSize:12, cursor:'pointer' },
  redBtn:{ padding:'7px 16px', borderRadius:6, border:'1px solid rgba(239,83,80,0.3)', background:'transparent', color:'#EF5350', fontSize:12, cursor:'pointer' },
  goldBtn:{ padding:'7px 16px', borderRadius:6, border:'none', background:'rgba(212,168,83,0.1)', color:'#D4A853', fontSize:12, cursor:'pointer' },
  revForm:{ background:'#161616', border:'1px solid #1e1e1e', borderRadius:10, padding:20, marginTop:12 },
  stars: { display:'flex', gap:6, marginBottom:12 },
  star:  { fontSize:22, cursor:'pointer', color:'#333', transition:'color .15s' },
  starA: { color:'#D4A853' },
  textarea:{ width:'100%', background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:8, padding:'10px 14px', color:'#d0d0d0', fontSize:13, resize:'vertical' as const, minHeight:80, outline:'none', marginBottom:10 },
  submitBtn:{ padding:'9px 24px', borderRadius:7, border:'none', background:'linear-gradient(135deg,#D4A853,#a67c30)', color:'#0f0f0f', fontWeight:600, fontSize:13, cursor:'pointer' },
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  pending:   { background:'rgba(255,167,38,0.1)', color:'#FFA726' },
  confirmed: { background:'rgba(76,175,80,0.1)',  color:'#66BB6A' },
  completed: { background:'rgba(66,165,245,0.1)', color:'#42A5F5' },
  cancelled: { background:'rgba(239,83,80,0.1)',  color:'#EF5350' },
};
const STATUS_LABEL: Record<string, string> = {
  pending:'Ожидает', confirmed:'Подтверждено', completed:'Завершено', cancelled:'Отменено'
};

export default function CabinetPage() {
  const { user, token } = useAuth();
  const [tab, setTab]   = useState<'upcoming'|'history'|'reviews'>('upcoming');
  const [apps, setApps] = useState<Appointment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewForm, setReviewForm] = useState<{ apptId: number; rating: number; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reload = () => {
    if (!token) return;
    appointmentsApi.list(token).then(setApps).catch(() => {});
    reviewsApi.list().then(r => setReviews(r.filter(rv => rv.author_id === user?.id))).catch(() => {});
  };
  useEffect(reload, [token]);

  const upcoming = apps.filter(a => ['pending','confirmed'].includes(a.status));
  const history  = apps.filter(a => ['completed','cancelled'].includes(a.status));

  const cancel = async (id: number) => {
    await appointmentsApi.updateStatus(id, 'cancelled', token!);
    reload();
  };

  const submitReview = async () => {
    if (!reviewForm || !token) return;
    setSubmitting(true);
    try {
      const { id: revId } = await reviewsApi.create({ appointment_id: reviewForm.apptId, rating: reviewForm.rating, text: reviewForm.text }, token);
      await mlApi.sentiment(revId, reviewForm.text);
      setReviewForm(null); reload();
    } catch (e: any) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  const AppCard = ({ a }: { a: Appointment }) => {
    const rf = reviewForm?.apptId === a.id ? reviewForm : null;
    const hasReview = reviews.some(r => r.id === a.id);
    return (
      <div style={S.card}>
        <div style={S.row}>
          <span style={S.sname}>{a.service_icon} {a.service_name}</span>
          <span style={{ ...S.badge, ...STATUS_STYLE[a.status] }}>{STATUS_LABEL[a.status]}</span>
        </div>
        <div style={S.meta}>{a.master_name} · {a.date} в {a.time_slot} · {a.total_price?.toLocaleString()}₽</div>
        <div style={S.actions}>
          {['pending','confirmed'].includes(a.status) && (
            <button style={S.redBtn} onClick={() => cancel(a.id)}>Отменить</button>
          )}
          {a.status === 'completed' && !hasReview && (
            <button style={S.goldBtn}
              onClick={() => setReviewForm(rf ? null : { apptId: a.id, rating: 5, text: '' })}>
              {rf ? 'Закрыть' : '★ Оставить отзыв'}
            </button>
          )}
        </div>
        {rf && (
          <div style={S.revForm}>
            <div style={S.stars}>
              {[1,2,3,4,5].map(n => (
                <span key={n} style={{ ...S.star, ...(n<=rf.rating ? S.starA : {}) }}
                  onClick={() => setReviewForm(f => f ? {...f, rating:n} : f)}>★</span>
              ))}
            </div>
            <textarea style={S.textarea} placeholder="Ваш отзыв..." value={rf.text}
              onChange={e => setReviewForm(f => f ? {...f, text:e.target.value} : f)} />
            <button style={{ ...S.submitBtn, opacity: submitting ? 0.6 : 1 }}
              onClick={submitReview} disabled={submitting}>Отправить</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={S.wrap}>
      <h1 style={S.title}>Личный кабинет</h1>
      <p style={S.sub}>Добро пожаловать, {user?.name}</p>
      <div style={S.tabs}>
        {[{k:'upcoming',l:'Предстоящие'},{k:'history',l:'История'},{k:'reviews',l:'Мои отзывы'}].map(t => (
          <button key={t.k} style={{ ...S.tab, ...(tab===t.k ? S.tabA : {}) }}
            onClick={() => setTab(t.k as typeof tab)}>{t.l}</button>
        ))}
      </div>

      {tab === 'upcoming' && (
        upcoming.length === 0
          ? <p style={{ color:'#555', textAlign:'center', padding:40 }}>Нет предстоящих записей</p>
          : upcoming.map(a => <AppCard key={a.id} a={a} />)
      )}
      {tab === 'history' && (
        history.length === 0
          ? <p style={{ color:'#555', textAlign:'center', padding:40 }}>История пуста</p>
          : history.map(a => <AppCard key={a.id} a={a} />)
      )}
      {tab === 'reviews' && (
        reviews.length === 0
          ? <p style={{ color:'#555', textAlign:'center', padding:40 }}>Вы ещё не оставляли отзывов</p>
          : reviews.map(r => (
            <div key={r.id} style={S.card}>
              <div style={S.row}>
                <span style={S.sname}>{r.service_name}</span>
                <span>{'★'.repeat(r.rating)}</span>
              </div>
              <p style={{ color:'#aaa', fontSize:13, marginTop:8 }}>{r.text}</p>
              <div style={{ ...S.meta, marginTop:8 }}>{r.master_name} · {r.created_at?.slice(0,10)} · {r.status}</div>
            </div>
          ))
      )}
    </div>
  );
}
