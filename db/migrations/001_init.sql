-- ============================================================================
-- Resource Reservation Management System - initial schema
--
-- Key design decision:
--   Double-booking is prevented BY THE DATABASE, not only by application code.
--   An EXCLUDE constraint over (resource_id, time range) makes it impossible for
--   two confirmed reservations of the same resource to overlap, even when two
--   requests arrive at the same millisecond. Application-level "check then
--   insert" logic has a race condition; this constraint does not.
-- ============================================================================

-- Needed so that "resource_id WITH =" (a scalar) can be combined with a range
-- overlap operator inside one GiST index.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- resource_types: lookup table (Meeting Room, Vehicle, Equipment ...)
-- ---------------------------------------------------------------------------
CREATE TABLE resource_types (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
);

-- ---------------------------------------------------------------------------
-- resources: the shared facilities / assets that can be reserved
-- ---------------------------------------------------------------------------
CREATE TABLE resources (
    id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type_id              INTEGER NOT NULL REFERENCES resource_types(id) ON DELETE RESTRICT,
    name                 TEXT NOT NULL UNIQUE,
    location             TEXT,
    description          TEXT,
    capacity             INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
    -- Daily booking window, in the organisation's local time.
    open_time            TIME NOT NULL DEFAULT '08:00',
    close_time           TIME NOT NULL DEFAULT '18:00',
    -- Longest single reservation allowed (stops one person blocking a room all day).
    max_duration_minutes INTEGER NOT NULL DEFAULT 480 CHECK (max_duration_minutes > 0),
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT resources_hours_valid CHECK (close_time > open_time)
);

CREATE INDEX idx_resources_type ON resources(type_id);

-- ---------------------------------------------------------------------------
-- users: people / teams who make reservations (no login in this scope;
-- identified by e-mail so the same person is never duplicated)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    team       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness of e-mail.
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------
CREATE TABLE reservations (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    resource_id  INTEGER NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title        TEXT NOT NULL,
    notes        TEXT,
    attendees    INTEGER NOT NULL DEFAULT 1 CHECK (attendees > 0),
    start_time   TIMESTAMPTZ NOT NULL,
    end_time     TIMESTAMPTZ NOT NULL,
    status       TEXT NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('confirmed', 'cancelled')),
    cancelled_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT reservations_time_valid CHECK (end_time > start_time),
    CONSTRAINT reservations_cancel_consistent CHECK (
        (status = 'cancelled' AND cancelled_at IS NOT NULL)
        OR (status = 'confirmed' AND cancelled_at IS NULL)
    ),

    -- THE important one: no two CONFIRMED reservations of the same resource
    -- may overlap. '[)' = start inclusive, end exclusive, so back-to-back
    -- bookings (10:00-11:00 then 11:00-12:00) are allowed.
    -- Cancelled reservations are ignored, so a cancelled slot becomes free again.
    CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
        resource_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
    ) WHERE (status = 'confirmed')
);

CREATE INDEX idx_reservations_resource_time ON reservations (resource_id, start_time);
CREATE INDEX idx_reservations_user ON reservations (user_id);
CREATE INDEX idx_reservations_status_start ON reservations (status, start_time);

-- ---------------------------------------------------------------------------
-- reservation_events: lightweight audit trail (created / cancelled)
-- ---------------------------------------------------------------------------
CREATE TABLE reservation_events (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    event_type     TEXT NOT NULL CHECK (event_type IN ('created', 'cancelled')),
    detail         TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservation_events_reservation ON reservation_events (reservation_id);
