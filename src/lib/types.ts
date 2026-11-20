export type Profile = { id: string; name: string; color: string; avatar_url?: string | null };

export type List = {
  id: string;
  name: string;
  owner_id: string;
  invite_token: string;
  created_at: string;
};

export type Member = {
  list_id: string;
  user_id: string;
  role: 'owner' | 'editor';
  notify_shop: boolean;
  notify_add: boolean;
  profiles: Profile | null;
};

export type Invite = { id: string; list_id: string; email: string; accepted_at: string | null };

// One record per item+type.
export type Item = {
  id: string;
  list_id: string;
  catalog_key: string | null; // catalog id; null for custom items
  name: string;               // canonical name (catalog name, or what was typed)
  shown_as: string;           // the alias it was added under; '' = its own name
  kind: string;               // which illustration
  shape: string;              // custom items: container picture ('' = letter only)
  variant: string;            // the type; '' = none ("Plain" counts as none)
  note: string;
  qty: number;
  unit: string;
  units: string[];
  step: number;
  grp: string;                // aisle
  sort_order: number;         // learned shopping order
  must_buy: boolean;
  on_list: boolean;
  in_cart: boolean;
  added_by: string | null;
  cart_by: string | null;
  carted_at: string | null;
  is_custom: boolean;
  forgotten: boolean;
  copy_of: string | null;      // a second copy made while the first was in the cart
  note_at: string | null;      // when the note was last edited
  created_at: string;
  updated_at: string;
};

export type Purchase = {
  id: string;
  item_id: string;
  list_id: string;
  bought_by: string | null;
  bought_at: string;
  qty: number | null;
  unit: string | null;
};

export type SortMode = 'usual' | 'alpha' | 'category' | 'priority';
