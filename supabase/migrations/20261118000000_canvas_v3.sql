-- bskt: catalog v3 and the quick-edit callout
--  * items.shown_as   the alias an item was added under ("Trash bags" for Bin bags); empty = its own name
--  * items.shape      custom items only: the container picture behind their letter ("pack", "jar"...)
--  * items.forgotten  custom items the user chose never to see suggested again (the record is kept)
--  * items.carted_at  when it went into the cart (shopping order learning, "Shopping now")
--  * purchases.qty / unit   what was bought, for the suggested amount (most common of the last 5)
-- Purchases are now recorded at Checkout, not when something is put in the cart.

alter table public.items add column if not exists shown_as  text not null default '';
alter table public.items add column if not exists shape     text not null default '';
alter table public.items add column if not exists forgotten boolean not null default false;
alter table public.items add column if not exists carted_at timestamptz;

alter table public.purchases add column if not exists qty  numeric;
alter table public.purchases add column if not exists unit text;

-- catalog ids renamed in catalog v3
update public.items set catalog_key = 'apple'   where catalog_key = 'apples';
update public.items set catalog_key = 'banana'  where catalog_key = 'bananas';
update public.items set catalog_key = 'carrot'  where catalog_key = 'carrots';
update public.items set catalog_key = 'onion'   where catalog_key = 'onions';
update public.items set catalog_key = 'potato'  where catalog_key = 'potatoes';
update public.items set catalog_key = 'lemon'   where catalog_key = 'lemons';
update public.items set catalog_key = 'tomato'  where catalog_key = 'tomatoes';
update public.items set catalog_key = 'generic' where catalog_key = 'toilet';

-- group words are no longer catalog items; keep any such records as custom items
update public.items set catalog_key = null, is_custom = true
  where catalog_key in ('herbs', 'berries', 'spices', 'nuts');

-- "Plain" is the same as no type
update public.items set variant = '' where lower(trim(variant)) = 'plain';
