-- Fix Class Connect: spinner sync, session notification panel, and Realtime.
-- Restrictive RLS (e.g. "only own selection row") hides other students' picks from
-- SELECT and from postgres_changes — so the student wheel, outcomes, and alerts break.
--
-- Apply with: supabase db push   or paste into SQL Editor (project must match).

-- ---------------------------------------------------------------------------
-- participation_selection_requests: class-wide read + teacher write + student response
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "cc_sel_req_select_class_scope" ON public.participation_selection_requests;
CREATE POLICY "cc_sel_req_select_class_scope"
ON public.participation_selection_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = participation_selection_requests.class_id
      AND c.teacher_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.class_members cm
    WHERE cm.class_id = participation_selection_requests.class_id
      AND cm.student_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cc_sel_req_insert_teacher" ON public.participation_selection_requests;
CREATE POLICY "cc_sel_req_insert_teacher"
ON public.participation_selection_requests
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = participation_selection_requests.class_id
      AND c.teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cc_sel_req_update_teacher" ON public.participation_selection_requests;
CREATE POLICY "cc_sel_req_update_teacher"
ON public.participation_selection_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = participation_selection_requests.class_id
      AND c.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = participation_selection_requests.class_id
      AND c.teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cc_sel_req_update_student_own" ON public.participation_selection_requests;
CREATE POLICY "cc_sel_req_update_student_own"
ON public.participation_selection_requests
FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "cc_sel_req_delete_teacher" ON public.participation_selection_requests;
CREATE POLICY "cc_sel_req_delete_teacher"
ON public.participation_selection_requests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = participation_selection_requests.class_id
      AND c.teacher_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- class_session_logs: students need SELECT for notification panel + realtime
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "cc_session_logs_select_class_scope" ON public.class_session_logs;
CREATE POLICY "cc_session_logs_select_class_scope"
ON public.class_session_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = class_session_logs.class_id
      AND c.teacher_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.class_members cm
    WHERE cm.class_id = class_session_logs.class_id
      AND cm.student_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cc_session_logs_insert_teacher" ON public.class_session_logs;
CREATE POLICY "cc_session_logs_insert_teacher"
ON public.class_session_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = class_session_logs.class_id
      AND c.teacher_id = auth.uid()
  )
  AND teacher_id = auth.uid()
);

-- Students append session logs when volunteering (see ClassPageStudent handleVolunteer).
DROP POLICY IF EXISTS "cc_session_logs_insert_student_member" ON public.class_session_logs;
CREATE POLICY "cc_session_logs_insert_student_member"
ON public.class_session_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.class_members cm
    WHERE cm.class_id = class_session_logs.class_id
      AND cm.student_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- notifications: teacher dashboard inserts + reads (optional if table was locked down)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "cc_notifications_select_own" ON public.notifications;
CREATE POLICY "cc_notifications_select_own"
ON public.notifications
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "cc_notifications_insert_own" ON public.notifications;
CREATE POLICY "cc_notifications_insert_own"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "cc_notifications_update_own" ON public.notifications;
CREATE POLICY "cc_notifications_update_own"
ON public.notifications
FOR UPDATE
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- ---------------------------------------------------------------------------
-- participation + volunteer_queue: class-scoped SELECT so feeds + Realtime work
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "cc_participation_select_class_scope" ON public.participation;
CREATE POLICY "cc_participation_select_class_scope"
ON public.participation
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = participation.class_id
      AND c.teacher_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.class_members cm
    WHERE cm.class_id = participation.class_id
      AND cm.student_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cc_participation_insert_teacher" ON public.participation;
CREATE POLICY "cc_participation_insert_teacher"
ON public.participation
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = participation.class_id
      AND c.teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cc_volunteer_queue_select_class_scope" ON public.volunteer_queue;
CREATE POLICY "cc_volunteer_queue_select_class_scope"
ON public.volunteer_queue
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = volunteer_queue.class_id
      AND c.teacher_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.class_members cm
    WHERE cm.class_id = volunteer_queue.class_id
      AND cm.student_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cc_volunteer_queue_insert_student" ON public.volunteer_queue;
CREATE POLICY "cc_volunteer_queue_insert_student"
ON public.volunteer_queue
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.class_members cm
    WHERE cm.class_id = volunteer_queue.class_id
      AND cm.student_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cc_volunteer_queue_update_teacher" ON public.volunteer_queue;
CREATE POLICY "cc_volunteer_queue_update_teacher"
ON public.volunteer_queue
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = volunteer_queue.class_id
      AND c.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = volunteer_queue.class_id
      AND c.teacher_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cc_volunteer_queue_delete_teacher" ON public.volunteer_queue;
CREATE POLICY "cc_volunteer_queue_delete_teacher"
ON public.volunteer_queue
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = volunteer_queue.class_id
      AND c.teacher_id = auth.uid()
  )
);

-- If postgres_changes still does not fire, confirm in Supabase Dashboard:
-- Database -> Replication -> supabase_realtime includes at least:
--   participation_selection_requests, class_session_logs, participation,
--   volunteer_queue, class_members, classes
