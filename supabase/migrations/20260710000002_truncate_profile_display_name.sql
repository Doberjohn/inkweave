-- Fix: a long OAuth display name aborted signup. handle_new_user() inserted the
-- raw provider name into public.profiles.display_name, but the table has
-- `check (char_length(display_name) <= 60)`. A Google/Discord user whose name
-- exceeds 60 chars made the trigger's INSERT violate the check, and because the
-- trigger is SECURITY DEFINER inside the auth signup transaction, that aborted
-- the whole signup. Truncate to 60 so the insert can never violate the check.
-- (avatar_url has no length constraint, so it is left as-is.)
--
-- CREATE OR REPLACE preserves the function's existing grants, but the REVOKE is
-- repeated defensively so this stays advisor-clean if replayed on a fresh DB.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(
      coalesce(
        nullif(new.raw_user_meta_data ->> 'name', ''),
        nullif(new.raw_user_meta_data ->> 'full_name', '')
      ),
      60
    ),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', '')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
