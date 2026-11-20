-- Promote the Telegram account with this ID to the initial administrator.
-- Run only after that account has opened the Mini App at least once.
insert into public.admins (user_id, role)
select id, 'admin'
from public.users
where telegram_id = 6784446117
on conflict (user_id) do update set role = 'admin';

-- Verify: this should return exactly one row.
select u.telegram_id, u.first_name, a.role
from public.users u
join public.admins a on a.user_id = u.id
where u.telegram_id = 6784446117;
