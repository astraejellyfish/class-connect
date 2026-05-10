-- If you already ran the first version of 20260511121500 (self-join on class_members),
-- Postgres reports: infinite recursion detected in policy for relation "class_members".
-- Run this migration (or paste this file) to replace that policy with a safe version.

create or replace function public.current_user_enrolled_in_class(p_class_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform set_config('row_security', 'off', true);
  return exists (
    select 1
    from public.class_members cm
    where cm.class_id = p_class_id
      and cm.student_id = auth.uid()
  );
end;
$$;

revoke all on function public.current_user_enrolled_in_class(uuid) from public;
grant execute on function public.current_user_enrolled_in_class(uuid) to authenticated;

drop policy if exists "cc_class_members_select_scope" on public.class_members;

create policy "cc_class_members_select_scope"
on public.class_members
for select
to authenticated
using (
  exists (
    select 1
    from public.classes c
    where c.id = class_members.class_id
      and c.teacher_id = auth.uid()
  )
  or student_id = auth.uid()
  or public.current_user_enrolled_in_class(class_members.class_id)
);
