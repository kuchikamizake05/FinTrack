-- Store the amount received separately when a transfer converts currency.
alter table account_transfers
  add column if not exists destination_amount numeric,
  add column if not exists destination_currency text;

update account_transfers
set destination_amount = amount,
    destination_currency = currency
where destination_amount is null or destination_currency is null;

alter table account_transfers
  alter column destination_amount set not null,
  alter column destination_currency set not null,
  alter column destination_currency set default 'IDR';

alter table account_transfers
  drop constraint if exists account_transfers_destination_amount_check;
alter table account_transfers
  add constraint account_transfers_destination_amount_check check (destination_amount > 0);
alter table account_transfers
  drop constraint if exists account_transfers_destination_currency_check;
alter table account_transfers
  add constraint account_transfers_destination_currency_check check (destination_currency ~ '^[A-Z]{3}$');

create or replace function validate_financial_account_links()
returns trigger as $$
declare
  source_currency text;
  target_currency text;
begin
  if tg_table_name = 'account_transfers' then
    select currency into source_currency from financial_accounts where id = new.source_account_id and user_id = new.user_id;
    select currency into target_currency from financial_accounts where id = new.destination_account_id and user_id = new.user_id;

    if source_currency is null or target_currency is null then
      raise exception 'Account must belong to the transfer owner';
    end if;
    if new.currency <> source_currency or new.destination_currency <> target_currency then
      raise exception 'Transfer currency must match its linked account currency';
    end if;
    if source_currency = target_currency and new.amount <> new.destination_amount then
      raise exception 'Same-currency transfers must use the same sent and received amount';
    end if;
  elsif new.account_id is not null then
    perform assert_account_owner(new.account_id, new.user_id);
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function apply_transfer_balance()
returns trigger as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform apply_account_delta(old.source_account_id, old.amount);
    perform apply_account_delta(old.destination_account_id, -old.destination_amount);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform apply_account_delta(new.source_account_id, -new.amount);
    perform apply_account_delta(new.destination_account_id, new.destination_amount);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql;
