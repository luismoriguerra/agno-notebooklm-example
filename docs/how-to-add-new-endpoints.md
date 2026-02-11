# How to Add New Endpoints

Guide for adding custom FastAPI endpoints alongside the AgentOS auto-generated routes.

## Architecture

AgentOS automatically provides routes for managing teams, agents, and sessions:

- `GET /teams` -- list teams
- `POST /teams/{team_id}/runs` -- run a team
- `GET /sessions` -- list sessions
- `GET /health` -- health check
- ...and many more (see `GET /docs` for the full Swagger UI)

Custom endpoints are mounted on the same FastAPI app via `app.include_router()` in `backend/app/main.py`. By convention, custom routes use the `/api` prefix to avoid conflicts with AgentOS routes.

## Step-by-Step

### 1. Create a router file

Create a new file in `backend/api/`, e.g. `api/sources.py`:

```python
from fastapi import APIRouter

router = APIRouter()
```

### 2. Define Pydantic schemas

Define request and response models:

```python
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class SourceCreate(BaseModel):
    notebook_id: int
    source_type: str
    content: Optional[str] = None
    url: Optional[str] = None


class SourceResponse(BaseModel):
    id: int
    notebook_id: int
    source_type: str
    content: Optional[str] = None
    url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
```

The `model_config = {"from_attributes": True}` setting allows Pydantic to read data directly from SQLAlchemy model instances.

### 3. Add a database dependency

Reuse the same pattern from `api/notebooks.py`:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from fastapi import Depends
from db.url import db_url

engine = create_engine(db_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 4. Write endpoint functions

```python
from fastapi import HTTPException
from sqlalchemy import desc
from db.tables.source import SourcesTable


@router.get("/sources", response_model=list[SourceResponse])
def list_sources(notebook_id: int, db: Session = Depends(get_db)):
    """List all sources for a notebook."""
    sources = (
        db.query(SourcesTable)
        .filter(SourcesTable.notebook_id == notebook_id)
        .order_by(desc(SourcesTable.created_at))
        .all()
    )
    return sources


@router.post("/sources", response_model=SourceResponse, status_code=201)
def create_source(data: SourceCreate, db: Session = Depends(get_db)):
    """Add a new source."""
    source = SourcesTable(
        notebook_id=data.notebook_id,
        source_type=data.source_type,
        content=data.content,
        url=data.url,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@router.delete("/sources/{source_id}", status_code=204)
def delete_source(source_id: int, db: Session = Depends(get_db)):
    """Delete a source."""
    source = db.query(SourcesTable).filter(SourcesTable.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()
    return None
```

### 5. Access AgentOS internals (if needed)

If your endpoint needs to interact with AgentOS teams or agents (e.g. running a team), use the `set_agent_os()` injection pattern and **lazy imports** inside the function:

```python
from typing import Any

_agent_os: Any = None


def set_agent_os(os_instance: Any) -> None:
    global _agent_os
    _agent_os = os_instance


@router.post("/my-custom-run")
async def custom_run(message: str = Form(...)):
    # Lazy import to avoid startup issues
    from agno.os.routers.teams.router import team_response_streamer
    from agno.os.utils import get_team_by_id

    team = get_team_by_id(
        team_id="notebooklm",
        teams=_agent_os.teams,
        db=_agent_os.db,
        create_fresh=True,
    )
    # ... use team
```

The lazy import is important -- importing agno router internals at the module level can cause issues in production containers.

### 6. Register in `app/main.py`

Add the router to the FastAPI app:

```python
from api.sources import router as sources_router

# After app = agent_os.get_app()
app.include_router(sources_router, prefix="/api")
```

If the router uses `set_agent_os()`, call it after creating the AgentOS instance:

```python
from api.sources import set_agent_os as set_sources_os

set_sources_os(agent_os)
```

## Real-World Example: Notebooks CRUD

The existing `backend/api/notebooks.py` demonstrates a complete CRUD implementation:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notebooks` | GET | List all notebooks |
| `/api/notebooks` | POST | Create a notebook (JSON body) |
| `/api/notebooks/{id}` | GET | Get a single notebook |
| `/api/notebooks/{id}` | PUT | Update a notebook (JSON body) |
| `/api/notebooks/{id}` | DELETE | Delete a notebook |
| `/api/notebooks/{id}/run` | POST | Run team with notebook context (FormData) |
| `/api/notebooks/{id}/sessions` | GET | List sessions linked to a notebook |

## Real-World Example: Custom Team Run

The `POST /api/notebooks/{id}/run` endpoint in `api/notebooks.py` shows how to:

1. Fetch a database record (the notebook)
2. Inject context into the user message (prepend title, description, instructions)
3. Get the AgentOS team via `get_team_by_id()`
4. Generate a session ID and link it to the notebook in the `notebook_sessions` table
5. Stream the response using `team_response_streamer()` as an SSE `StreamingResponse`

## Frontend Integration

After creating backend endpoints, connect them from the frontend:

### Add the API route

In `frontend/src/api/routes.ts`:

```typescript
export const APIRoutes = {
  // ... existing routes
  ListSources: (agentOSUrl: string, notebookId: number) =>
    `${agentOSUrl}/api/sources?notebook_id=${notebookId}`,
  CreateSource: (agentOSUrl: string) =>
    `${agentOSUrl}/api/sources`,
}
```

### Create API functions

In `frontend/src/api/sources.ts`:

```typescript
const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function fetchSources(notebookId: number) {
  const response = await fetch(
    `${getBaseUrl()}/api/sources?notebook_id=${notebookId}`
  )
  if (!response.ok) return []
  return response.json()
}

export async function createSource(data: {
  notebook_id: number
  source_type: string
  content?: string
  url?: string
}) {
  const response = await fetch(`${getBaseUrl()}/api/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) return null
  return response.json()
}
```

### Update Zustand store (if needed)

If the new data needs to be shared across components, add it to `frontend/src/store.ts`:

```typescript
// In the Store interface:
sources: Source[]
setSources: (sources: Source[]) => void

// In the create() call:
sources: [],
setSources: (sources) => set({ sources }),
```

## Testing with curl

### GET (list)

```bash
curl http://localhost:8000/api/sources?notebook_id=1 | python3 -m json.tool
```

### POST (JSON body)

```bash
curl -X POST http://localhost:8000/api/sources \
  -H "Content-Type: application/json" \
  -d '{"notebook_id": 1, "source_type": "url", "url": "https://example.com"}'
```

### POST (FormData -- for run endpoints)

```bash
curl -X POST http://localhost:8000/api/notebooks/1/run \
  -F "message=Summarize the key points" \
  -F "stream=true"
```

### PUT (update)

```bash
curl -X PUT http://localhost:8000/api/notebooks/1 \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}'
```

### DELETE

```bash
curl -X DELETE http://localhost:8000/api/sources/1
```
