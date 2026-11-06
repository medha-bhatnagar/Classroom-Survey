create extension if not exists pgcrypto;

create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','active','closed','archived')),
  public_slug text unique not null default encode(gen_random_bytes(5), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('multiple_choice','true_false')),
  position integer not null,
  created_at timestamptz not null default now()
);
create table if not exists choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  choice_text text not null,
  position integer not null,
  created_at timestamptz not null default now()
);
create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  anonymous_token text,
  submitted_at timestamptz not null default now()
);
create unique index if not exists responses_unique_student_per_survey on responses(survey_id, anonymous_token) where anonymous_token is not null;
create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references responses(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  choice_id uuid references choices(id) on delete set null,
  text_answer text,
  created_at timestamptz not null default now(),
  unique(response_id, question_id)
);
create unique index if not exists only_one_active_survey on surveys(status) where status = 'active';
create index if not exists questions_survey_id_idx on questions(survey_id);
create index if not exists choices_question_id_idx on choices(question_id);
create index if not exists responses_survey_id_idx on responses(survey_id);
create index if not exists answers_response_id_idx on answers(response_id);

alter table surveys enable row level security;
alter table questions enable row level security;
alter table choices enable row level security;
alter table responses enable row level security;
alter table answers enable row level security;

create policy "public reads active surveys" on surveys for select to anon using (status = 'active');
create policy "public reads active questions" on questions for select to anon using (exists(select 1 from surveys s where s.id = survey_id and s.status = 'active'));
create policy "public reads active choices" on choices for select to anon using (exists(select 1 from questions q join surveys s on s.id = q.survey_id where q.id = question_id and s.status = 'active'));
create policy "authenticated manages surveys" on surveys for all to authenticated using (true) with check (true);
create policy "authenticated manages questions" on questions for all to authenticated using (true) with check (true);
create policy "authenticated manages choices" on choices for all to authenticated using (true) with check (true);
create policy "authenticated reads responses" on responses for select to authenticated using (true);
create policy "authenticated reads answers" on answers for select to authenticated using (true);

create or replace function activate_survey(p_survey_id uuid) returns surveys language plpgsql security definer set search_path = public as $$
declare result surveys;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  update surveys set status = 'closed' where status = 'active' and id <> p_survey_id;
  update surveys set status = 'active', public_slug = coalesce(public_slug, encode(gen_random_bytes(5), 'hex')) where id = p_survey_id returning * into result;
  if result.id is null then raise exception 'SURVEY_NOT_FOUND'; end if;
  return result;
end; $$;

create or replace function submit_survey_response(p_survey_id uuid, p_anonymous_token text, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare response_id uuid;
begin
  if not exists(select 1 from surveys where id = p_survey_id and status = 'active') then raise exception 'SURVEY_NOT_ACTIVE'; end if;
  if exists(select 1 from responses where survey_id = p_survey_id and anonymous_token = p_anonymous_token) then raise exception 'DUPLICATE_RESPONSE'; end if;
  insert into responses(survey_id, anonymous_token) values (p_survey_id, p_anonymous_token) returning id into response_id;
  insert into answers(response_id, question_id, choice_id)
  select response_id, (item->>'question_id')::uuid, (item->>'choice_id')::uuid
  from jsonb_array_elements(p_answers) item
  where exists(select 1 from questions q where q.id = (item->>'question_id')::uuid and q.survey_id = p_survey_id)
    and exists(select 1 from choices c join questions q on q.id = c.question_id where c.id = (item->>'choice_id')::uuid and q.survey_id = p_survey_id);
  return jsonb_build_object('success', true, 'response_id', response_id);
end; $$;
