-- Give the server-side service_role the table privileges required by the Data API.
-- Keep RLS enabled; do not grant these privileges to anon or authenticated.
grant usage on schema public to service_role;

grant select, insert, update, delete
on table
  public.users,
  public.plans,
  public.subscriptions,
  public.videos,
  public.admins
to service_role;
