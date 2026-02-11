---
name: agno-db-migrations
description: Set up and manage Alembic database migrations in Agno projects. Use when the user wants to create database tables, add a migration, run alembic, create a revision, manage schema changes, set up database migrations, or evolve the database schema.
---

# Agno Database Migrations with Alembic

Manage database schema changes in Agno projects using SQLAlchemy table definitions and Alembic migrations, following the [official Agno guide](https://docs.agno.com/production/aws/database-tables).

## Workflow Overview

1. Define tables in `db/tables/`
2. Import them in `db/tables/__init__.py`
3. Create a migration revision
4. Run the migration

## Initial Setup (One-Time)

If the project does not yet have Alembic configured, follow these steps. If `db/migrations/` and `alembic.ini` already exist, skip to [Adding a New Table](#adding-a-new-table).

### Step 1: Install Alembic

Add `alembic` to the project dependencies:

```bash
# If using requirements.txt
echo "alembic" >> requirements.txt

# If using pyproject.toml, add alembic to the dependencies list
```

Rebuild the Docker container after adding the dependency:

```bash
docker compose build notebooklm-api
```

### Step 2: Create the Base Model

Create `db/tables/base.py`:

```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
```

Create `db/tables/__init__.py`:

```python
from db.tables.base import Base
```

### Step 3: Initialize Alembic

Run inside the API container:

```bash
docker exec -it notebooklm-api alembic init db/migrations
```

### Step 4: Configure `alembic.ini`

Edit `alembic.ini` in the backend root:

- Set `script_location = db/migrations`
- Uncomment the `black` hook in `[post_write_hooks]` if available

For the complete `alembic.ini` template, see [references/ALEMBIC-SETUP.md](references/ALEMBIC-SETUP.md).

### Step 5: Configure `db/migrations/env.py`

Replace the generated `env.py` with a version that:

- Imports `Base.metadata` from `db.tables`
- Gets `db_url` from `db.url`
- Adds an `include_name` filter to only track tables in `Base.metadata`

For the complete `env.py` template, see [references/ALEMBIC-SETUP.md](references/ALEMBIC-SETUP.md).

---

## Adding a New Table

### Step 1: Create Table Definition

Create a file in `db/tables/`, e.g. `db/tables/user.py`:

```python
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql.expression import text
from sqlalchemy.types import BigInteger, DateTime, String

from db.tables.base import Base


class UsersTable(Base):
    __tablename__ = "dim_users"

    id_user: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True, nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=text("now()")
    )
```

### Step 2: Register the Table

Import the new table class in `db/tables/__init__.py`:

```python
from db.tables.base import Base
from db.tables.user import UsersTable
```

All table classes MUST be imported here so Alembic's autogenerate can detect them.

---

## Creating a Migration Revision

After adding or modifying table definitions, generate a migration:

```bash
# Via Docker (recommended for dev)
docker exec -it notebooklm-api alembic -c db/alembic.ini revision --autogenerate -m "describe your change"

# Without Docker (if running locally)
cd backend
alembic -c db/alembic.ini revision --autogenerate -m "describe your change"
```

Always review the generated migration file in `db/migrations/versions/` before applying. Alembic autogenerate does not detect:
- Table or column renames (shows as drop + create)
- Changes to constraints names
- Changes to column types in some cases

---

## Running Migrations

### Development

```bash
# Via Docker
docker exec -it notebooklm-api alembic -c db/alembic.ini upgrade head

# Without Docker
cd backend
alembic -c db/alembic.ini upgrade head
```

### Other Useful Commands

```bash
# Check current revision
docker exec -it notebooklm-api alembic -c db/alembic.ini current

# View migration history
docker exec -it notebooklm-api alembic -c db/alembic.ini history

# Downgrade one revision
docker exec -it notebooklm-api alembic -c db/alembic.ini downgrade -1

# Downgrade to specific revision
docker exec -it notebooklm-api alembic -c db/alembic.ini downgrade <revision_id>
```

### Production

Set the environment variable `MIGRATE_DB=True` and restart the service. This runs `alembic -c db/alembic.ini upgrade head` at container startup.

For manual production migration, SSH into the container and run:

```bash
alembic -c db/alembic.ini upgrade head
```

---

## Common Patterns

### Adding a Column

1. Add the column to the table class in `db/tables/`
2. Run `alembic revision --autogenerate -m "add column_name to table_name"`
3. Review and apply

### Adding an Index

```python
from sqlalchemy import Index

class MyTable(Base):
    __tablename__ = "my_table"
    # ... columns ...
    __table_args__ = (
        Index("ix_my_table_email", "email"),
    )
```

### Renaming a Column

Autogenerate cannot detect renames. Write a manual migration:

```bash
docker exec -it notebooklm-api alembic -c db/alembic.ini revision -m "rename column old_name to new_name"
```

Then edit the generated file:

```python
def upgrade():
    op.alter_column("table_name", "old_name", new_column_name="new_name")

def downgrade():
    op.alter_column("table_name", "new_name", new_column_name="old_name")
```

---

## Anti-Patterns

- **Never edit a migration file that has already been applied** to a database. Create a new migration instead.
- **Never skip reviewing autogenerated migrations.** They may contain destructive operations (drops) that should be manual renames.
- **Never delete migration files** from the `versions/` directory if they have been applied to any environment.
- **Always import new table classes** in `db/tables/__init__.py`. Forgetting this means Alembic will not detect the table.

## Additional Resources

- For complete setup templates (`base.py`, `alembic.ini`, `env.py`), see [references/ALEMBIC-SETUP.md](references/ALEMBIC-SETUP.md)
- [Agno Database Tables Guide](https://docs.agno.com/production/aws/database-tables)
- [Alembic Documentation](https://alembic.sqlalchemy.org/en/latest/)
- [SQLAlchemy ORM Tutorial](https://docs.sqlalchemy.org/en/20/orm/quickstart.html)
