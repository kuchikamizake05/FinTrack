-- Apply this migration once to databases created from an earlier schema.
-- The frontend and n8n workflows use a category name, not a category UUID.
alter table transactions add column if not exists category text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'category_id'
  ) then
    update transactions as transaction
    set category = categories.name
    from categories
    where transaction.category_id = categories.id
      and transaction.category is null;
  end if;
end;
$$;

update transactions set category = 'Lainnya' where category is null or btrim(category) = '';
alter table transactions alter column category set default 'Lainnya';
alter table transactions alter column category set not null;
alter table transactions drop column if exists category_id;

create index if not exists transactions_user_date_idx on transactions (user_id, date desc);
create index if not exists transactions_user_status_idx on transactions (user_id, status);
