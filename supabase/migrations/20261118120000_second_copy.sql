-- A second copy of an item+type may go on the list while the first is in the cart.
--  * items.copy_of  the record in the cart this copy was made from (combined again later)
--  * items.note_at  when the note was last edited (when two copies combine, the newer note wins)
alter table public.items add column if not exists copy_of uuid references public.items (id) on delete set null;
alter table public.items add column if not exists note_at timestamptz;
