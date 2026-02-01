-- Fix: allow operators to read client rows referenced by their assigned services
-- Current policy referenced service_resources only, but operator portal uses services.operator_id.

begin;

drop policy if exists "clients_operator_assigned_only" on public.clients;

create policy "clients_operator_assigned_only"
on public.clients
for select
to authenticated
using (
  is_operator_user_safe()
  and exists (
    select 1
    from public.operators o
    where o.user_id = auth.uid()
      and exists (
        select 1
        from public.services s
        where s.client_id = clients.id
          and (
            s.operator_id = o.id
            or exists (
              select 1
              from public.service_resources sr
              where sr.service_id = s.id
                and sr.operator_id = o.id
            )
          )
      )
  )
);

commit;