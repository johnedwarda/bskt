-- One-off repair: merge duplicate records of the same item+type left behind by earlier builds
-- (e.g. two "Coffee" or two "Bread" records with no type in one list).
--
-- Golden rule: one record per item+type in a list, plus at most one second copy while the first is
-- in the cart. Records count as the same item+type when they share the list, the item (catalog key,
-- or the name for custom items) and the type (case-insensitive; "plain" = no type).
--
-- For each group of duplicates:
--  - Records waiting on the list merge into one (the oldest), and so do records in the cart:
--    Must buy if any had it, the most recently written non-empty note, the larger amount.
--  - One on the list and one in the cart both stay: a valid second copy, linked to the one in the cart.
--  - The whole purchase history moves to one record (the one in the cart, else the one on the list,
--    else the oldest), so nothing is lost; the other records are deleted.
-- Safe to run more than once. The last query lists what's left of each merged group.

begin;

create temp table fam on commit drop as
select i.id, i.created_at, i.updated_at, i.must_buy, i.note, i.note_at, i.qty, i.unit,
       i.list_id::text || '|' || coalesce(i.catalog_key, 'custom:' || lower(trim(i.name))) || '|' ||
         case when lower(trim(i.variant)) = 'plain' then '' else lower(trim(i.variant)) end as fkey,
       case when i.on_list and i.in_cart then 'cart' when i.on_list then 'list' else 'off' end as bucket
from public.items i;

delete from fam where fkey in (select fkey from fam group by fkey having count(*) = 1);

-- the record that stays in each bucket: the oldest
create temp table target on commit drop as
select distinct on (fkey, bucket) fkey, bucket, id as target_id, unit as target_unit
from fam order by fkey, bucket, created_at, id;

-- off-list records only stay when the group has nothing on the list or in the cart
delete from target t
where t.bucket = 'off' and exists (select 1 from target x where x.fkey = t.fkey and x.bucket <> 'off');

-- the record that holds the history
create temp table holder on commit drop as
select distinct on (fkey) fkey, target_id as hold_id
from target order by fkey, case bucket when 'cart' then 0 when 'list' then 1 else 2 end;

-- 1. merge each bucket's records into its target
update public.items t set
  must_buy = m.must_buy,
  note     = m.note,
  note_at  = m.note_at,
  qty      = m.qty
from (
  select tg.target_id,
         bool_or(f.must_buy) as must_buy,
         (array_agg(f.note order by (f.note <> '') desc, f.note_at desc nulls last, f.updated_at desc))[1] as note,
         max(f.note_at) as note_at,
         max(f.qty) filter (where f.unit = tg.target_unit) as qty
  from fam f join target tg on tg.fkey = f.fkey and tg.bucket = f.bucket
  where tg.bucket <> 'off'
  group by tg.target_id
) m
where t.id = m.target_id;

-- 2. move the whole history to the holder (before any delete: deleting an item deletes its purchases)
update public.purchases p set item_id = h.hold_id
from fam f join holder h using (fkey)
where p.item_id = f.id and f.id <> h.hold_id;

-- 3. delete everything else in the group
delete from public.items i
using fam f
where i.id = f.id and f.id not in (select target_id from target);

-- 4. one on the list and one in the cart: the one on the list is the second copy
update public.items i set copy_of = c.target_id
from target l join target c on c.fkey = l.fkey and c.bucket = 'cart'
where l.bucket = 'list' and i.id = l.target_id;

-- what's left of each merged group
select i.name, i.variant, i.qty, i.unit, i.note, i.must_buy, i.on_list, i.in_cart,
       (select count(*) from public.purchases p where p.item_id = i.id) as purchases
from public.items i
where i.id in (select target_id from target)
order by i.name;

commit;
