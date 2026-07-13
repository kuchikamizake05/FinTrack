-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Table: categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- Null jika kategori bawaan/global
  name text not null,
  type text not null check (type in ('income', 'expense')) default 'expense',
  icon text, -- Nama icon Lucide
  color text, -- Kode warna HSL/HEX
  created_at timestamp with time zone default now()
);

-- Row Level Security (RLS) untuk categories
alter table categories enable row level security;

-- Policy categories: User bisa membaca kategori miliknya sendiri atau kategori global (user_id is null)
create policy "Users can view default or their own categories"
  on categories for select
  using (user_id is null or auth.uid() = user_id);

create policy "Users can insert their own categories"
  on categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own categories"
  on categories for update
  using (auth.uid() = user_id);

create policy "Users can delete their own categories"
  on categories for delete
  using (auth.uid() = user_id);


-- 2. Table: transactions
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  type text not null check (type in ('income', 'expense')) default 'expense',
  merchant text,
  -- Nama kategori disimpan sebagai snapshot agar data transaksi tetap utuh
  -- bila kategori kemudian diubah atau dihapus.
  category text not null default 'Lainnya',
  amount numeric not null check (amount >= 0),
  note text,
  source text not null check (source in ('telegram_text', 'telegram_receipt', 'manual')),
  receipt_url text, -- Path ke Supabase Storage jika ada struk
  raw_text text, -- Teks hasil parsing OCR mentah
  ai_confidence numeric check (ai_confidence >= 0 and ai_confidence <= 1),
  status text not null check (status in ('confirmed', 'pending_approval', 'needs_review', 'deleted')) default 'confirmed',
  telegram_message_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Row Level Security (RLS) untuk transactions
alter table transactions enable row level security;

-- Policy transactions: User hanya bisa mengelola transaksi miliknya sendiri
create policy "Users can view their own transactions"
  on transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own transactions"
  on transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own transactions"
  on transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own transactions"
  on transactions for delete
  using (auth.uid() = user_id);


-- 3. Table: transaction_items (detail struk belanja)
create table transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete cascade not null,
  name text not null,
  qty numeric default 1,
  price numeric check (price >= 0),
  created_at timestamp with time zone default now()
);

-- Row Level Security (RLS) untuk transaction_items
alter table transaction_items enable row level security;

-- Policy transaction_items: User hanya bisa melihat detail transaksi milik mereka sendiri
create policy "Users can view items of their own transactions"
  on transaction_items for select
  using (
    exists (
      select 1 from transactions 
      where transactions.id = transaction_items.transaction_id 
      and transactions.user_id = auth.uid()
    )
  );

create policy "Users can insert items for their own transactions"
  on transaction_items for insert
  with check (
    exists (
      select 1 from transactions 
      where transactions.id = transaction_items.transaction_id 
      and transactions.user_id = auth.uid()
    )
  );

create policy "Users can update items of their own transactions"
  on transaction_items for update
  using (
    exists (
      select 1 from transactions 
      where transactions.id = transaction_items.transaction_id 
      and transactions.user_id = auth.uid()
    )
  );

create policy "Users can delete items of their own transactions"
  on transaction_items for delete
  using (
    exists (
      select 1 from transactions 
      where transactions.id = transaction_items.transaction_id 
      and transactions.user_id = auth.uid()
    )
  );


-- 4. Trigger untuk updated_at pada transactions
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_transactions_updated_at
  before update on transactions
  for each row
  execute function update_updated_at_column();

create index transactions_user_date_idx on transactions (user_id, date desc);
create index transactions_user_status_idx on transactions (user_id, status);


-- Seed data untuk categories (Global/Default Categories)
insert into categories (name, type, icon, color) values
  ('Makanan & Minuman', 'expense', 'Utensils', '#ef4444'),
  ('Transportasi', 'expense', 'Car', '#3b82f6'),
  ('Belanja Harian', 'expense', 'ShoppingBag', '#10b981'),
  ('Tagihan', 'expense', 'CreditCard', '#f59e0b'),
  ('Hiburan', 'expense', 'Tv', '#8b5cf6'),
  ('Kesehatan', 'expense', 'HeartPulse', '#ec4899'),
  ('Pendidikan', 'expense', 'GraduationCap', '#06b6d4'),
  ('Rumah', 'expense', 'Home', '#64748b'),
  ('Pekerjaan', 'expense', 'Briefcase', '#f97316'),
  ('Gaji', 'income', 'TrendingUp', '#22c55e'),
  ('Freelance', 'income', 'Laptop', '#14b8a6'),
  ('Lainnya', 'expense', 'CircleEllipsis', '#78716c');
