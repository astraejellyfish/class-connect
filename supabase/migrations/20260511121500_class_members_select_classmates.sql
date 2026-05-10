-- Students must see every class_members row for their class (same roster as the teacher),
-- or the spinner cannot resolve the picked classmate, selection status stays empty, and the wheel does not spin.
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
  or exists (
    select 1
    from public.class_members me
    where me.class_id = class_members.class_id
      and me.student_id = auth.uid()
  )
);
