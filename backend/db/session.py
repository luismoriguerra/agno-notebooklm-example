from agno.db.postgres import PostgresDb

from db.url import db_url

DB_ID = "notebooklm-db"


def get_postgres_db() -> PostgresDb:
    return PostgresDb(id=DB_ID, db_url=db_url)
