-- Allow reading profile rows for class peers, and teachers for students in their classes
-- (needed for participation_selection_requests -> students() embed and roster names).
drop policy if exists "cc_students_select_classmates" on public.students;
create policy "cc_students_select_classmates"
on public.students
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.classes c
    inner join public.class_members cm on cm.class_id = c.id
    where cm.student_id = students.id
      and c.teacher_id = auth.uid()
  )
  or exists (
    select 1
    from public.class_members cm_target
    inner join public.class_members cm_self
      on cm_self.class_id = cm_target.class_id
     and cm_self.student_id = auth.uid()
    where cm_target.student_id = students.id
  )
);
