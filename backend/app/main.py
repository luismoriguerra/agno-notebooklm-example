from os import getenv

from agno.os import AgentOS

from agents.notebooklm_team import notebooklm_team
from db import get_postgres_db

agent_os = AgentOS(
    name="NotebookLM",
    id="notebooklm-os",
    db=get_postgres_db(),
    teams=[notebooklm_team],
)

app = agent_os.get_app()

if __name__ == "__main__":
    agent_os.serve(
        app="app.main:app",
        reload=getenv("RUNTIME_ENV", "prd") == "dev",
    )
