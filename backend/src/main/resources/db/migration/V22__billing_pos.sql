-- Counter billing (POS) for Canteen Admin / Sub Admin. Entirely additive and isolated: every
-- table is new and prefixed pos_, none touches orders, wallets, payments or menu_items.
-- Rollback (manual, no data outside these tables depends on them):
--   drop table pos_bill_items, pos_bills, pos_held_carts, pos_bill_counters, pos_settings,
--              pos_items, pos_categories;

create table pos_categories (
    id         uuid        primary key,
    name       varchar(80) not null,
    sort_order integer     not null default 0,
    active     boolean     not null default true,
    created_at timestamptz not null,
    updated_at timestamptz not null
);
create unique index uq_pos_category_name on pos_categories (lower(name)) where active;

create table pos_items (
    id          uuid          primary key,
    category_id uuid          not null references pos_categories (id),
    name        varchar(120)  not null,
    price       numeric(10, 2) not null,
    emoji       varchar(16)   not null default '',
    available   boolean       not null default true,
    favorite    boolean       not null default false,
    sort_order  integer       not null default 0,
    active      boolean       not null default true,
    created_at  timestamptz   not null,
    updated_at  timestamptz   not null,
    constraint chk_pos_item_price check (price >= 0 and price <= 99999999)
);
create unique index uq_pos_item_name on pos_items (category_id, lower(name)) where active;

-- Singleton: the CHECK pins the one allowed row.
create table pos_settings (
    id                  smallint     primary key default 1,
    business_name       varchar(120) not null default 'TuckZone Canteen',
    address             varchar(255) not null default '',
    phone               varchar(30)  not null default '',
    gstin               varchar(20)  not null default '',
    footer_message      varchar(160) not null default 'Thank you! Visit again.',
    currency_symbol     varchar(4)   not null default 'Rs',
    gst_percent         numeric(5, 2) not null default 5.00,
    gst_enabled_default boolean      not null default true,
    updated_at          timestamptz  not null default now(),
    constraint chk_pos_settings_singleton check (id = 1),
    constraint chk_pos_settings_gst check (gst_percent >= 0 and gst_percent <= 100)
);
insert into pos_settings (id) values (1);

-- One row per calendar day; the upsert in PosBillNumberer row-locks it, so concurrent
-- checkouts serialise and can never receive the same number.
create table pos_bill_counters (
    bill_date   date    primary key,
    last_number integer not null
);

create table pos_bills (
    id              uuid          primary key,
    invoice_number  varchar(32)   not null,
    bill_date       date          not null,
    created_by      uuid          not null references users (id),
    idempotency_key varchar(80)   not null,
    subtotal        numeric(12, 2) not null,
    gst_percent     numeric(5, 2)  not null,
    gst_amount      numeric(12, 2) not null,
    total           numeric(12, 2) not null,
    -- Manually recorded by the cashier; never confirmed by any gateway.
    payment_method  varchar(10),
    status          varchar(10)   not null,
    void_reason     varchar(255),
    voided_by       uuid references users (id),
    voided_at       timestamptz,
    -- Receipt header as it was when the bill was issued, so later settings edits cannot
    -- change a reprint.
    business_name   varchar(120)  not null,
    address         varchar(255)  not null,
    phone           varchar(30)   not null,
    gstin           varchar(20)   not null,
    footer_message  varchar(160)  not null,
    currency_symbol varchar(4)    not null,
    created_at      timestamptz   not null,
    updated_at      timestamptz   not null,
    constraint uq_pos_bill_invoice unique (invoice_number),
    constraint uq_pos_bill_idem unique (created_by, idempotency_key),
    constraint chk_pos_bill_total check (total = subtotal + gst_amount and subtotal > 0 and gst_amount >= 0),
    constraint chk_pos_bill_status check (status in ('COMPLETED', 'VOID')),
    constraint chk_pos_bill_payment check (payment_method is null or payment_method in ('CASH', 'UPI', 'CARD', 'OTHER')),
    constraint chk_pos_bill_void check ((status = 'VOID') = (void_reason is not null))
);
create index idx_pos_bill_date on pos_bills (bill_date);
create index idx_pos_bill_creator on pos_bills (created_by, created_at desc);

-- Line snapshots: name/price are copied at sale time. item_id has no FK on purpose so a
-- catalog change can never cascade into history.
create table pos_bill_items (
    id         uuid           primary key,
    bill_id    uuid           not null references pos_bills (id),
    item_id    uuid,
    item_name  varchar(120)   not null,
    emoji      varchar(16)    not null default '',
    unit_price numeric(10, 2) not null,
    quantity   integer        not null,
    line_total numeric(12, 2) not null,
    created_at timestamptz    not null,
    updated_at timestamptz    not null,
    constraint chk_pos_line_qty check (quantity > 0),
    constraint chk_pos_line_total check (line_total = unit_price * quantity)
);
create index idx_pos_bill_items_bill on pos_bill_items (bill_id);

-- Parked carts ("hold"). Only item ids + quantities: a resumed cart is re-priced from the
-- live catalog, as in the reference app.
create table pos_held_carts (
    id         uuid        primary key,
    created_by uuid        not null references users (id),
    label      varchar(80) not null default '',
    lines      jsonb       not null,
    created_at timestamptz not null,
    updated_at timestamptz not null
);
create index idx_pos_held_creator on pos_held_carts (created_by, created_at desc);
