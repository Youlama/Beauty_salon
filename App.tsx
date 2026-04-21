import { useState, useEffect, createContext, useContext } from 'react'
import { authApi } from './api'
import type { User } from './types'

// ─── Auth context ────────────────────────────────────────────────
interface AuthCtx { user: User | null; token: string | null; login(t: string, u: User): void; logout(): void }
const AuthContext = createContext<AuthCtx>({ user: null, token: null, login: () => {}, logout: () => {} })
export const useAuth = () => useContext(AuthContext)

// ─── Pages (lazy imports avoided for simplicity) ─────────────────
import LoginPage     from './pages/LoginPage'
import HomePage      from './pages/HomePage'
import ServicesPage  from './pages/ServicesPage'
import MastersPage   from './pages/MastersPage'
import GalleryPage   from './pages/GalleryPage'
import BookingPage   from './pages/BookingPage'
import ProfilePage   from './pages/ProfilePage'
import AdminPage     from './pages/AdminPage'
import MasterPage    from './pages/MasterPage'


const G = {
  gold: '#D4A853', darkBg: '#0f0f0f', cardBg: '#161616',
  border: '#1e1e1e', textMuted: '#666', textSub: '#aaa',
}

function Nav({ page, setPage }: { page: string; setPage(p: string): void }) {
  const { user, logout } = useAuth()
  const links = [
    { id: 'home', l: 'Главная' },
    { id: 'services', l: 'Услуги' },
    { id: 'masters', l: 'Мастера' },
    { id: 'gallery', l: 'Галерея' },
    ...(user ? [{ id: 'profile', l: 'Личный кабинет' }] : []),
    ...(user?.role === 'admin' ? [{ id: 'admin', l: 'Панель админа' }] : []),
    ...(user?.role === 'master' ? [{ id: 'master', l: 'Мой кабинет' }] : []),
  ]
  return (
    <nav style={{ background: '#141414', borderBottom: `1px solid ${G.border}`, padding: '0 40px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 100 }}>
      <button onClick={() => setPage('home')} style={{ background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: '#e8e8e8', letterSpacing: '0.1em' }}>
        ✦ BELLE
      </button>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {links.map(l => (
          <button key={l.id} onClick={() => setPage(l.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 6,
              fontSize: 13, color: page === l.id ? G.gold : G.textMuted, fontFamily: 'inherit',
              transition: 'color .2s' }}>
            {l.l}
          </button>
        ))}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%',
              background: `linear-gradient(135deg, ${G.gold}, #a67c30)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#0f0f0f' }}>
              {user.name.slice(0,2).toUpperCase()}
            </div>
            <button onClick={logout} style={{ background: 'none', border: `1px solid ${G.border}`,
              borderRadius: 6, padding: '5px 12px', color: G.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              Выйти
            </button>
          </div>
        ) : (
          <button onClick={() => setPage('login')}
            style={{ marginLeft: 12, padding: '7px 18px', borderRadius: 8, border: 'none',
              background: `linear-gradient(135deg, ${G.gold}, #a67c30)`,
              color: '#0f0f0f', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Войти
          </button>
        )}
      </div>
    </nav>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [page, setPage] = useState('home')

  useEffect(() => {
    const t = localStorage.getItem('belle_token')
    const u = localStorage.getItem('belle_user')
    if (t && u) { setToken(t); setUser(JSON.parse(u)) }
  }, [])

  const login = (t: string, u: User) => {
    setToken(t); setUser(u)
    localStorage.setItem('belle_token', t)
    localStorage.setItem('belle_user', JSON.stringify(u))
    setPage(u.role === 'admin' ? 'admin' : u.role === 'master' ? 'master' : 'profile')
  }

  const logout = () => {
    setToken(null); setUser(null)
    localStorage.removeItem('belle_token'); localStorage.removeItem('belle_user')
    setPage('home')
  }

  const pages: Record<string, JSX.Element> = {
    home:     <HomePage setPage={setPage} />,
    services: <ServicesPage setPage={setPage} />,
    masters:  <MastersPage setPage={setPage} />,
    gallery:  <GalleryPage />,
    booking:  <BookingPage setPage={setPage} />,
    profile:  <ProfilePage setPage={setPage} />,
    admin:    <AdminPage />,
    master:   <MasterPage />,
    login:    <LoginPage onSuccess={login} setPage={setPage} />,
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      <div style={{ minHeight: '100vh', background: G.darkBg }}>
        <Nav page={page} setPage={setPage} />
        <main style={{ animation: 'fadeIn .4s ease' }}>
          {pages[page] ?? pages.home}
        </main>
        <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
      </div>
    </AuthContext.Provider>
  )
}
