-- =====================================================================
-- Migration: create_contacts
-- الهدف: جدول بيحفظ معلومات كل واحد بيضغط "Contact me" بالسي في
-- وبيعبّي الفورم، عشان تعرف مين شاف السي في وتواصل معك.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) الجدول
-- كل صف = رسالة تواصل وحدة. الـ id بيتولّد تلقائياً.
-- الإيميل مش unique: نفس الشخص ممكن يتواصل معك أكثر من مرة.
-- ---------------------------------------------------------------------
create table public.contacts (
  id          uuid        primary key default gen_random_uuid(),
  first_name  text        not null check (char_length(first_name) between 1 and 100),
  last_name   text        not null check (char_length(last_name)  between 1 and 100),
  phone       text        not null check (char_length(phone)      between 1 and 30),
  email       text        not null check (char_length(email)      between 3 and 254),
  created_at  timestamptz not null default now()
);

comment on table public.contacts is 'People who filled in the Contact me form on the CV.';


-- ---------------------------------------------------------------------
-- 2) الحماية (Row Level Security)
-- الزائر (anon key) بيقدر يضيف صف بس.
-- ما حدا بيقدر يقرأ أو يعدّل أو يحذف من المتصفح،
-- إنت بتشوف البيانات من لوحة Supabase (Table Editor → contacts).
-- ---------------------------------------------------------------------
alter table public.contacts enable row level security;

grant insert on public.contacts to anon, authenticated;

create policy "Anyone can send contact details"
  on public.contacts
  for insert
  to anon, authenticated
  with check (true);
