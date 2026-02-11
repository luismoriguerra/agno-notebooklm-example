# How to Create Migrations

Step-by-step guide for making database schema changes with Alembic.

## Setup Overview

The Alembic configuration consists of three parts:

- **`backend/alembic.ini`** -- points to `db/migrations` and uses `db_url` from `db/url.py`
- **`backend/db/migrations/env.py`** -- connects to the database, loads `Base.metadata`, and filters to only track tables defined in our models (ignoring Agno's internal tables)
- **`backend/db/tables/`** -- SQLAlchemy model files that extend `Base` from `db/tables/base.py`

All table classes **must** be imported in `db/tables/__init__.py` for Alembic autogenerate to detect them.

## Adding a New Table

### Step 1: Create the model file

Create a new file in `backend/db/tables/`, e.g. `db/tables/source.py`:

```python
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql.expression import text
from sqlalchemy.types import BigInteger, DateTime, String, Text

from db.tables.base import Base


class SourcesTable(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True, nullable=False, index=True
    )
    notebook_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_type: Mapped[str] = mapped_column(String(50))  # "url", "file", "text"
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
```

### Step 2: Register in `__init__.py`

Add the import to `backend/db/tables/__init__.py`:

```python
from db.tables.base import Base
from db.tables.notebook import NotebooksTable
from db.tables.notebook_session import NotebookSessionsTable
from db.tables.source import SourcesTable  # <-- add this
```

If you skip this step, Alembic will not detect the new table.

### Step 3: Generate the migration

From the `backend/` directory:

```bash
cd backend
alembic -c alembic.ini revision --autogenerate -m "add sources table"
```

Or via Docker:

```bash
docker exec -it notebooklm-api alembic -c alembic.ini revision --autogenerate -m "add sources table"
```

This creates a new file in `db/migrations/versions/` with the auto-detected changes.

### Step 4: Review the generated migration

Open the file in `db/migrations/versions/` and verify:

- The `upgrade()` function creates the expected table/columns
- The `downgrade()` function drops them correctly
- No unexpected operations (e.g. dropping existing tables)

### Step 5: Apply locally

```bash
cd backend
alembic -c alembic.ini upgrade head
```

Or via Docker:

```bash
docker exec -it notebooklm-api alembic -c alembic.ini upgrade head
```

### Step 6: Apply to production

```bash
make migrate-prod
```

This runs `alembic upgrade head` with production environment variables injected via `railway run`.

## Adding a Column to an Existing Table

Follow the same steps as above, but modify the existing model file instead of creating a new one.

For example, to add a `source_count` column to `NotebooksTable`:

1. Edit `db/tables/notebook.py` and add the column:

```python
source_count: Mapped[int] = mapped_column(BigInteger, default=0)
```

2. Generate migration:

```bash
cd backend
alembic -c alembic.ini revision --autogenerate -m "add source_count to notebooks"
```

3. Review, apply locally, then apply to production.

## Checking Migration Status

### Local

```bash
cd backend
alembic -c alembic.ini current
```

### Production

```bash
make migrate-prod-status
```

### View migration history

```bash
cd backend
alembic -c alembic.ini history
```

## Rolling Back

### Downgrade one revision

```bash
cd backend
alembic -c alembic.ini downgrade -1
```

### Downgrade to a specific revision

```bash
cd backend
alembic -c alembic.ini downgrade <revision_id>
```

You can find revision IDs in the migration filenames or via `alembic history`.

## Common Pitfalls

1. **Forgetting to import in `__init__.py`**: Alembic autogenerate only detects tables that are imported and registered with `Base.metadata`. If your new table class isn't imported in `db/tables/__init__.py`, the migration will be empty.

2. **Renames detected as drop + create**: Alembic autogenerate cannot detect column or table renames. It will generate a `drop_column` + `add_column` instead. For renames, write a manual migration:

```bash
cd backend
alembic -c alembic.ini revision -m "rename column old_name to new_name"
```

Then edit the generated file:

```python
def upgrade():
    op.alter_column("table_name", "old_name", new_column_name="new_name")

def downgrade():
    op.alter_column("table_name", "new_name", new_column_name="old_name")
```

3. **Never edit an applied migration**: If a migration has already been applied to any database (local or production), create a new migration instead of editing the old one.

4. **Never delete migration files**: The `versions/` directory is an ordered chain. Deleting a file breaks the chain for any database that has applied it.

5. **Always review autogenerated migrations**: Check for unintended changes before applying. Autogenerate is a best-effort tool, not infallible.
