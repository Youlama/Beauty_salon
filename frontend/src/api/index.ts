const BASE = ''   // через Nginx: /api/auth/, /api/core/, /api/ml/, /api/analytics/

function token() {
  return localStorage.getItem('belle_token')
}

async function req(url: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  }
  if (token()) headers['Authorization'] = `Bearer ${token()}`

  const res = await fetch(BASE + url, { ...opts, headers })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Ошибка сервера')
  return data
}

// Auth
export const authApi = {
  register: (b: object) => req('/api/auth/register', { method: 'POST', body: JSON.stringify(b) }),
  login:    (b: object) => req('/api/auth/login',    { method: 'POST', body: JSON.stringify(b) }),
  me:       ()          => req('/api/auth/me'),
}

// Core
export const coreApi = {
  salonInfo:    ()             => req('/api/core/salon-info'),
  services:     (cat?: string) => req(`/api/core/services${cat ? `?category=${cat}` : ''}`),
  service:      (id: number)   => req(`/api/core/services/${id}`),
  createService:(b: object)    => req('/api/core/services', { method: 'POST', body: JSON.stringify(b) }),
  updateService:(id: number, b: object) => req(`/api/core/services/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  masters:      ()             => req('/api/core/masters'),
  master:       (id: number)   => req(`/api/core/masters/${id}`),
  schedule:     (date: string) => req(`/api/core/schedule?date=${date}`),
  setSchedule:  (mid: number, b: object) => req(`/api/core/masters/${mid}/schedule`, { method: 'PUT', body: JSON.stringify(b) }),
  gallery:      (p?: {master_id?: number; service_id?: number}) =>
    req(`/api/core/gallery${p ? '?' + new URLSearchParams(Object.entries(p).filter(([,v])=>v!=null).map(([k,v])=>[k,String(v)])) : ''}`),
  appointments: () => req('/api/core/appointments'),
  createAppt:   (b: object)    => req('/api/core/appointments', { method: 'POST', body: JSON.stringify(b) }),
  updateStatus: (id: number, status: string) => req(`/api/core/appointments/${id}/status?status=${status}`, { method: 'PATCH' }),
  reschedule:   (id: number, b: object) => req(`/api/core/appointments/${id}/reschedule`, { method: 'PATCH', body: JSON.stringify(b) }),
  reviews:      (p?: {master_id?: number}) =>
    req(`/api/core/reviews${p?.master_id ? `?master_id=${p.master_id}` : ''}`),
  pendingReviews: () => req('/api/core/reviews/pending'),
  createReview: (b: object)    => req('/api/core/reviews', { method: 'POST', body: JSON.stringify(b) }),
  moderateReview:(id: number, b: object) => req(`/api/core/reviews/${id}/moderate`, { method: 'PATCH', body: JSON.stringify(b) }),
}

// Analytics
export const analyticsApi = {
  revenue:      (from: string, to: string) => req(`/api/analytics/revenue?date_from=${from}&date_to=${to}`),
  mastersLoad:  (from: string, to: string) => req(`/api/analytics/masters-load?date_from=${from}&date_to=${to}`),
  popular:      ()             => req('/api/analytics/popular-services'),
  reviewsStats: ()             => req('/api/analytics/reviews-stats'),
  forecast:     ()             => req('/api/analytics/forecast'),
  export:       (fmt: string)  => req(`/api/analytics/export?format=${fmt}`),
}

// ML
export const mlApi = {
  sentiment:       (b: object) => req('/api/ml/sentiment', { method: 'POST', body: JSON.stringify(b) }),
  galleryRecs:     (uid: number) => req(`/api/ml/recommendations/gallery?user_id=${uid}`),
  crossSell:       (sid: number) => req(`/api/ml/recommendations/cross-sell?service_id=${sid}`),
}
