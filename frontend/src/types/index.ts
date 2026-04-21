export interface User {
  id: number
  name: string
  email: string
  phone?: string
  role: 'client' | 'master' | 'admin'
}

export interface AuthState {
  user: User | null
  token: string | null
}

export interface Service {
  id: number
  name: string
  category: 'hair' | 'nails' | 'face' | 'body'
  duration: number
  price: number
  icon: string
  archived?: boolean
}

export interface Master {
  id: number
  user_id: number
  name: string
  bio?: string
  specialties: string
  rating: number
  portfolio?: Photo[]
  reviews?: Review[]
  services?: Service[]
}

export interface Appointment {
  id: number
  client_id: number
  client_name: string
  service_id: number
  service_name: string
  service_icon: string
  master_id: number
  master_name: string
  date: string
  time_slot: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  total_price: number
}

export interface Review {
  id: number
  author_name: string
  master_name?: string
  service_name?: string
  rating: number
  text: string
  sentiment?: 'positive' | 'neutral' | 'negative' | 'pending'
  status?: 'pending' | 'approved' | 'rejected'
  admin_reply?: string
  created_at: string
  priority?: boolean
}

export interface Photo {
  id: number
  photo_url: string
  master_name?: string
  service_name?: string
  category?: string
  created_at: string
}

export interface SalonInfo {
  name: string
  address: string
  hours: string
  phone: string
  email: string
  instagram?: string
  vk?: string
}
