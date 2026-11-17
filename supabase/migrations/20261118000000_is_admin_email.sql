-- =====================================================================
-- Migration: is_admin_email
-- الهدف: فورم "Forgot password" بيسأل: هل هاد الإيميل تبع الأدمن؟
-- الدالة بترجّع true أو false بس، والإيميل نفسه ما بيطلع للمتصفح أبداً.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) الدالة
-- security definer: بتشتغل بصلاحية صاحبها عشان تقدر تقرأ auth.users،
-- بس ما بترجّع غير آه/لأ.
-- search_path فاضي: عشان ما حدا يقدر يغيّر الجداول اللي بتقرأ منها.
-- المقارنة ما بتفرق بين الأحرف الكبيرة والصغيرة.
-- ---------------------------------------------------------------------
create or replace function public.is_admin_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = 'c1baed7b-26f7-4d7d-99a1-ebf1c30350a7'::uuid
      and lower(email) = lower(trim(p_email))
  );
$$;

comment on function public.is_admin_email(text) is 'True if the given email belongs to the admin account. Used by the Forgot password form.';


-- ---------------------------------------------------------------------
-- 2) الصلاحيات: الزائر (anon) والمسجّل بيقدروا يستدعوها بس.
-- ---------------------------------------------------------------------
revoke all on function public.is_admin_email(text) from public;
grant execute on function public.is_admin_email(text) to anon, authenticated;
