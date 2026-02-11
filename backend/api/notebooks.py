from datetime import datetime
from typing import Any, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, desc
from sqlalchemy.orm import Session, sessionmaker

from agno.os.routers.teams.router import team_response_streamer
from agno.os.utils import get_team_by_id

from db.tables.notebook import NotebooksTable
from db.tables.notebook_session import NotebookSessionsTable
from db.url import db_url

# Create engine and session factory
engine = create_engine(db_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

router = APIRouter()

# Will be set by main.py after AgentOS is created
_agent_os: Any = None


def set_agent_os(os_instance: Any) -> None:
    """Called from main.py to inject the AgentOS reference."""
    global _agent_os
    _agent_os = os_instance


# --- Pydantic Schemas ---


class NotebookCreate(BaseModel):
    title: str = "Untitled notebook"
    description: Optional[str] = None
    instructions: Optional[str] = None


class NotebookUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None


class NotebookResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class NotebookSessionResponse(BaseModel):
    session_id: str
    notebook_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Dependency ---


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- CRUD Endpoints ---


@router.get("/notebooks", response_model=list[NotebookResponse])
def list_notebooks(db: Session = Depends(get_db)):
    """List all notebooks ordered by most recently updated."""
    notebooks = (
        db.query(NotebooksTable)
        .order_by(desc(NotebooksTable.updated_at), desc(NotebooksTable.created_at))
        .all()
    )
    return notebooks


@router.post("/notebooks", response_model=NotebookResponse, status_code=201)
def create_notebook(data: NotebookCreate, db: Session = Depends(get_db)):
    """Create a new notebook."""
    notebook = NotebooksTable(
        title=data.title,
        description=data.description,
        instructions=data.instructions,
    )
    db.add(notebook)
    db.commit()
    db.refresh(notebook)
    return notebook


@router.get("/notebooks/{notebook_id}", response_model=NotebookResponse)
def get_notebook(notebook_id: int, db: Session = Depends(get_db)):
    """Get a single notebook by ID."""
    notebook = db.query(NotebooksTable).filter(NotebooksTable.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return notebook


@router.put("/notebooks/{notebook_id}", response_model=NotebookResponse)
def update_notebook(notebook_id: int, data: NotebookUpdate, db: Session = Depends(get_db)):
    """Update an existing notebook."""
    notebook = db.query(NotebooksTable).filter(NotebooksTable.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(notebook, key, value)

    db.commit()
    db.refresh(notebook)
    return notebook


@router.delete("/notebooks/{notebook_id}", status_code=204)
def delete_notebook(notebook_id: int, db: Session = Depends(get_db)):
    """Delete a notebook."""
    notebook = db.query(NotebooksTable).filter(NotebooksTable.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    db.delete(notebook)
    db.commit()
    return None


# --- Notebook Run Endpoint ---


@router.post("/notebooks/{notebook_id}/run")
async def notebook_run(
    notebook_id: int,
    message: str = Form(...),
    stream: bool = Form(True),
    session_id: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Run the NotebookLM team with notebook context injected."""
    if _agent_os is None:
        raise HTTPException(status_code=500, detail="AgentOS not initialized")

    # Fetch the notebook
    notebook = db.query(NotebooksTable).filter(NotebooksTable.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    # Build context prefix from notebook metadata
    context_parts = [f"[Notebook: {notebook.title}]"]
    if notebook.description:
        context_parts.append(f"[Description: {notebook.description}]")
    if notebook.instructions:
        context_parts.append(f"[Instructions: {notebook.instructions}]")
    context_prefix = "\n".join(context_parts) + "\n\n"
    full_message = context_prefix + message

    # Get the team (first team available)
    team = get_team_by_id(
        team_id="notebooklm",
        teams=_agent_os.teams,
        db=_agent_os.db,
        create_fresh=True,
    )
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    # Handle session ID
    is_new_session = not session_id or session_id == ""
    if is_new_session:
        session_id = str(uuid4())

    # Link session to notebook
    existing_link = (
        db.query(NotebookSessionsTable)
        .filter(NotebookSessionsTable.session_id == session_id)
        .first()
    )
    if not existing_link:
        link = NotebookSessionsTable(
            notebook_id=notebook_id,
            session_id=session_id,
        )
        db.add(link)
        db.commit()

    if stream:
        return StreamingResponse(
            team_response_streamer(
                team,
                full_message,
                session_id=session_id,
                user_id=user_id,
            ),
            media_type="text/event-stream",
        )
    else:
        run_response = await team.arun(
            input=full_message,
            session_id=session_id,
            user_id=user_id,
            stream=False,
        )
        return run_response.to_dict()


# --- Notebook Sessions Endpoint ---


@router.get("/notebooks/{notebook_id}/sessions", response_model=List[NotebookSessionResponse])
def list_notebook_sessions(notebook_id: int, db: Session = Depends(get_db)):
    """List all sessions linked to a notebook."""
    # Verify notebook exists
    notebook = db.query(NotebooksTable).filter(NotebooksTable.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    sessions = (
        db.query(NotebookSessionsTable)
        .filter(NotebookSessionsTable.notebook_id == notebook_id)
        .order_by(desc(NotebookSessionsTable.created_at))
        .all()
    )
    return sessions
