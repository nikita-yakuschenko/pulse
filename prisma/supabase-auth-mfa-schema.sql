-- Миграция Supabase Auth (GoTrue): таблицы и типы MFA.
-- Выполнить ОДИН РАЗ целиком на БД (туннель/psql/SQL Editor). После применения
-- ОБЯЗАТЕЛЬНО перезапустить сервис Auth (GoTrue), иначе будет ошибка
-- "cached plan must not change result type".

-- 1) Enum-типы (auth.factor_type, auth.factor_status, auth.aal_level)
do $$ begin
  create type auth.factor_type as enum('totp', 'webauthn');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  alter type auth.factor_type add value 'phone';
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type auth.factor_status as enum('unverified', 'verified');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type auth.aal_level as enum('aal1', 'aal2', 'aal3');
exception
  when duplicate_object then null;
end $$;

-- 2) Таблица auth.mfa_factors — сразу со всеми колонками под текущий GoTrue
create table if not exists auth.mfa_factors (
  id uuid not null,
  user_id uuid not null,
  friendly_name text null,
  factor_type auth.factor_type not null,
  status auth.factor_status not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  secret text null,
  last_challenged_at timestamptz null,
  phone text null,
  web_authn_aaguid uuid null,
  web_authn_credential bytea null,
  constraint mfa_factors_pkey primary key (id),
  constraint mfa_factors_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);
comment on table auth.mfa_factors is 'auth: stores metadata about factors';

-- Добавить недостающие колонки, если таблица уже была создана старым скриптом
alter table auth.mfa_factors add column if not exists last_challenged_at timestamptz null;
alter table auth.mfa_factors add column if not exists phone text null;
alter table auth.mfa_factors add column if not exists web_authn_aaguid uuid null;
alter table auth.mfa_factors add column if not exists web_authn_credential bytea null;

create unique index if not exists mfa_factors_user_friendly_name_unique
  on auth.mfa_factors (friendly_name, user_id) where trim(friendly_name) <> '';
create unique index if not exists unique_verified_phone_factor on auth.mfa_factors (user_id, phone);

-- 3) Таблица auth.mfa_challenges
create table if not exists auth.mfa_challenges (
  id uuid not null,
  factor_id uuid not null,
  created_at timestamptz not null,
  verified_at timestamptz null,
  ip_address inet not null,
  constraint mfa_challenges_pkey primary key (id),
  constraint mfa_challenges_auth_factor_id_fkey foreign key (factor_id) references auth.mfa_factors(id) on delete cascade
);
comment on table auth.mfa_challenges is 'auth: stores metadata about challenge requests made';
alter table auth.mfa_challenges add column if not exists otp_code text null;

-- 4) Таблица auth.mfa_amr_claims (если ещё нет; часто уже есть в Supabase)
create table if not exists auth.mfa_amr_claims (
  session_id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  authentication_method text not null,
  constraint mfa_amr_claims_session_id_authentication_method_pkey unique (session_id, authentication_method),
  constraint mfa_amr_claims_session_id_fkey foreign key (session_id) references auth.sessions(id) on delete cascade
);
comment on table auth.mfa_amr_claims is 'auth: stores authenticator method reference claims for multi factor authentication';
alter table auth.mfa_amr_claims add column if not exists id uuid null;

-- 5) Колонки factor_id и aal в auth.sessions (для MFA)
alter table auth.sessions add column if not exists factor_id uuid null;
alter table auth.sessions add column if not exists aal auth.aal_level null;

-- 6) Индексы MFA
create index if not exists user_id_created_at_idx on auth.sessions (user_id, created_at);
create index if not exists factor_id_created_at_idx on auth.mfa_factors (user_id, created_at);
create index if not exists mfa_challenge_created_at_idx on auth.mfa_challenges (created_at desc);
create index if not exists mfa_factors_user_id_idx on auth.mfa_factors (user_id);

-- 7) Права на таблицы MFA: всем ролям, у которых уже есть SELECT на auth.users (в т.ч. роль GoTrue)
do $$
declare r record;
begin
  for r in (
    select distinct grantee as rolname
    from information_schema.role_table_grants
    where table_schema = 'auth' and table_name = 'users' and privilege_type = 'SELECT'
  )
  loop
    execute format('GRANT SELECT, INSERT, UPDATE, DELETE ON auth.mfa_factors TO %I', r.rolname);
    execute format('GRANT SELECT, INSERT, UPDATE, DELETE ON auth.mfa_challenges TO %I', r.rolname);
  end loop;
end $$;
