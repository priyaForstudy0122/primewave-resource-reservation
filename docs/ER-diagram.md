# Entity Relationship Diagram

GitHub renders the Mermaid diagram below automatically.

```mermaid
erDiagram
    RESOURCE_TYPES ||--o{ RESOURCES : "classifies"
    RESOURCES      ||--o{ RESERVATIONS : "is reserved in"
    USERS          ||--o{ RESERVATIONS : "makes"
    RESERVATIONS   ||--o{ RESERVATION_EVENTS : "has audit trail"

    RESOURCE_TYPES {
        int id PK
        text name UK
        text description
    }

    RESOURCES {
        int id PK
        int type_id FK
        text name UK
        text location
        text description
        int capacity
        time open_time
        time close_time
        int max_duration_minutes
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    USERS {
        int id PK
        text name
        text email UK "unique on lower(email)"
        text team
        timestamptz created_at
    }

    RESERVATIONS {
        int id PK
        int resource_id FK
        int user_id FK
        text title
        text notes
        int attendees
        timestamptz start_time
        timestamptz end_time
        text status "confirmed | cancelled"
        timestamptz cancelled_at
        timestamptz created_at
    }

    RESERVATION_EVENTS {
        int id PK
        int reservation_id FK
        text event_type "created | cancelled"
        text detail
        timestamptz created_at
    }
```

## Key constraint (not visible in the diagram)

`reservations` has an **EXCLUDE USING gist** constraint on `(resource_id =, tstzrange(start_time, end_time, '[)') &&) WHERE status = 'confirmed'`.
It makes overlapping confirmed reservations for the same resource impossible at database level.
