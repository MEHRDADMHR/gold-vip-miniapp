create or replace function public.review_payment_order(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_decision text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_plan public.plans%rowtype;
  v_expiry timestamptz;
  v_subscription_id uuid;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'تصمیم نامعتبر است';
  end if;

  if not exists (select 1 from public.admins where user_id = p_admin_user_id and role = 'admin') then
    raise exception 'فقط مدیر اصلی مجاز است';
  end if;

  select * into v_order from public.payment_orders
  where id = p_order_id for update;

  if not found or v_order.status <> 'pending' then
    raise exception 'سفارش پیدا نشد یا قبلاً بررسی شده است';
  end if;

  if p_decision = 'rejected' then
    update public.payment_orders
      set status = 'rejected', reviewed_by = p_admin_user_id,
          reviewed_at = now(), updated_at = now()
      where id = p_order_id;
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  select * into v_plan from public.plans where id = v_order.plan_id;
  if not found then raise exception 'پلن سفارش پیدا نشد'; end if;

  select max(expires_at) into v_expiry
  from public.subscriptions
  where user_id = v_order.user_id and status = 'active' and expires_at > now();

  insert into public.subscriptions (
    user_id, plan_id, status, starts_at, expires_at,
    payment_provider, payment_reference
  ) values (
    v_order.user_id, v_order.plan_id, 'active',
    coalesce(v_expiry, now()),
    coalesce(v_expiry, now()) + make_interval(days => v_plan.duration_days),
    case when v_order.payment_method = 'usdt'
      then 'manual_usdt_' || coalesce(v_order.network, 'unknown')
      when v_order.payment_method = 'card' then 'manual_card'
      else 'manual_' || v_order.payment_method end,
    v_order.payment_reference
  ) returning id into v_subscription_id;

  update public.payment_orders
    set status = 'approved', reviewed_by = p_admin_user_id,
        reviewed_at = now(), updated_at = now()
    where id = p_order_id;

  return jsonb_build_object('ok', true, 'status', 'approved', 'subscription_id', v_subscription_id);
end;
$$;

revoke all on function public.review_payment_order(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.review_payment_order(uuid, uuid, text) to service_role;
