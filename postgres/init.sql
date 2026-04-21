-- Belle Salon — инициализация базы данных
-- Все таблицы в одной БД; каждый микросервис работает со своими таблицами.

-- ─── auth-service ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    phone       VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role        VARCHAR(20) NOT NULL DEFAULT 'client',  -- client | master | admin
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── core-service ────────────────────────────────────────────────
CREATE TYPE service_category AS ENUM ('hair','nails','face','body');
CREATE TYPE appt_status      AS ENUM ('pending','confirmed','completed','cancelled');
CREATE TYPE review_sentiment AS ENUM ('positive','neutral','negative','pending');
CREATE TYPE review_status    AS ENUM ('pending','approved','rejected');

CREATE TABLE IF NOT EXISTS masters (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bio          TEXT,
    specialties  VARCHAR(255) NOT NULL DEFAULT 'hair',
    rating       NUMERIC(3,1) DEFAULT 5.0
);

CREATE TABLE IF NOT EXISTS services (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    category    service_category NOT NULL,
    duration    INTEGER NOT NULL,          -- минуты
    price       NUMERIC(10,2) NOT NULL,
    icon        VARCHAR(10) DEFAULT '✂️',
    archived    BOOLEAN DEFAULT FALSE
);

-- Связь услуга ↔ мастер (цена может отличаться)
CREATE TABLE IF NOT EXISTS master_services (
    master_id   INTEGER REFERENCES masters(id) ON DELETE CASCADE,
    service_id  INTEGER REFERENCES services(id) ON DELETE CASCADE,
    price_override NUMERIC(10,2),
    PRIMARY KEY (master_id, service_id)
);

CREATE TABLE IF NOT EXISTS appointments (
    id          SERIAL PRIMARY KEY,
    client_id   INTEGER REFERENCES users(id),
    service_id  INTEGER REFERENCES services(id),
    master_id   INTEGER REFERENCES masters(id),
    date        DATE NOT NULL,
    time_slot   TIME NOT NULL,
    status      appt_status DEFAULT 'pending',
    total_price NUMERIC(10,2),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
    id          SERIAL PRIMARY KEY,
    appointment_id INTEGER UNIQUE REFERENCES appointments(id),
    author_id   INTEGER REFERENCES users(id),
    master_id   INTEGER REFERENCES masters(id),
    service_id  INTEGER REFERENCES services(id),
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text        TEXT NOT NULL,
    sentiment   review_sentiment DEFAULT 'pending',
    status      review_status DEFAULT 'pending',
    admin_reply TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_photos (
    id          SERIAL PRIMARY KEY,
    master_id   INTEGER REFERENCES masters(id) ON DELETE CASCADE,
    service_id  INTEGER REFERENCES services(id),
    photo_url   TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_schedule (
    id          SERIAL PRIMARY KEY,
    master_id   INTEGER REFERENCES masters(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL,         -- 1=Пн .. 7=Вс
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    UNIQUE (master_id, day_of_week)
);

-- ─── Seed данные ─────────────────────────────────────────────────
-- Пароль для всех: test1234  (bcrypt hash)
INSERT INTO users (name, email, phone, password_hash, role) VALUES
  ('Администратор', 'admin@salon.ru', '+7 (999) 000-00-00',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMUhD7G2ZyEXZkfLqZ2d3sP2Cq', 'admin'),
  ('Анна Петрова',  'anna@salon.ru',  '+7 (999) 111-11-11',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMUhD7G2ZyEXZkfLqZ2d3sP2Cq', 'master'),
  ('Мария Козлова', 'maria@salon.ru', '+7 (999) 222-22-22',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMUhD7G2ZyEXZkfLqZ2d3sP2Cq', 'master'),
  ('Ирина Клиентова','irina@mail.ru', '+7 (999) 333-33-33',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMUhD7G2ZyEXZkfLqZ2d3sP2Cq', 'client'),
  ('Светлана Морозова','sveta@mail.ru','+7 (999) 444-44-44',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMUhD7G2ZyEXZkfLqZ2d3sP2Cq', 'client')
ON CONFLICT (email) DO NOTHING;

INSERT INTO masters (user_id, bio, specialties) VALUES
  (2, 'Профессиональный стилист с 8 лет опыта.', 'hair'),
  (3, 'Специалист по ногтевому сервису.', 'nails')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO services (name, category, duration, price, icon) VALUES
  ('Стрижка женская',        'hair',  60,  3500, '✂️'),
  ('Стрижка мужская',        'hair',  30,  1800, '✂️'),
  ('Окрашивание',            'hair',  120, 7500, '🎨'),
  ('Укладка',                'hair',  45,  2500, '💇'),
  ('Маникюр классический',   'nails', 60,  2000, '💅'),
  ('Маникюр с покрытием',    'nails', 90,  3200, '💅'),
  ('Педикюр',                'nails', 75,  2800, '🦶'),
  ('Чистка лица',            'face',  60,  4000, '🧖'),
  ('Наращивание ресниц',     'face',  120, 5000, '👁️'),
  ('Ламинирование бровей',   'face',  45,  2200, '✏️')
ON CONFLICT DO NOTHING;

-- Привязки мастер ↔ услуга
INSERT INTO master_services (master_id, service_id) VALUES
  (1,1),(1,2),(1,3),(1,4),
  (2,5),(2,6),(2,7)
ON CONFLICT DO NOTHING;

-- Расписание мастеров (Пн-Пт 9:00-19:00)
INSERT INTO master_schedule (master_id, day_of_week, start_time, end_time)
SELECT m.id, d, '09:00', '19:00'
FROM masters m, unnest(ARRAY[1,2,3,4,5]) AS d
ON CONFLICT DO NOTHING;

-- Тестовые записи
INSERT INTO appointments (client_id, service_id, master_id, date, time_slot, status, total_price)
VALUES
  (4, 1, 1, CURRENT_DATE + 1, '10:00', 'confirmed', 3500),
  (5, 5, 2, CURRENT_DATE + 1, '14:00', 'pending',   2000),
  (4, 3, 1, CURRENT_DATE - 7, '11:00', 'completed', 7500),
  (5, 6, 2, CURRENT_DATE - 3, '15:00', 'completed', 3200)
ON CONFLICT DO NOTHING;

-- Тестовые отзывы
INSERT INTO reviews (appointment_id, author_id, master_id, service_id, rating, text, sentiment, status)
VALUES
  (3, 4, 1, 3, 5, 'Прекрасное окрашивание! Анна — настоящий профессионал.', 'positive', 'approved'),
  (4, 5, 2, 6, 4, 'Хороший маникюр, но пришлось немного подождать.', 'neutral', 'approved')
ON CONFLICT DO NOTHING;
