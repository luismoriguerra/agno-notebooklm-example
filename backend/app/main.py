from os import getenv

from fastapi.middleware.cors import CORSMiddleware

from agno.os import AgentOS

from agents.notebooklm_team import notebooklm_team
from api.notebooks import router as notebooks_router, set_agent_os
from db import get_postgres_db

agent_os = AgentOS(
    name="NotebookLM",
    id="notebooklm-os",
    db=get_postgres_db(),
    teams=[notebooklm_team],
)

# Inject AgentOS reference so the notebook run endpoint can access teams
set_agent_os(agent_os)

app = agent_os.get_app()

# Mount custom API routes
app.include_router(notebooks_router, prefix="/api")

# Add CORS middleware to allow cross-origin requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    agent_os.serve(
        app="app.main:app",
        reload=getenv("RUNTIME_ENV", "prd") == "dev",
    )
