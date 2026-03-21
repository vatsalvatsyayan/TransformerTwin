"""
TransformerTwin — aiosqlite connection helper.

Provides a context-manager-based connection to the SQLite database.
All I/O must go through this module; never open aiosqlite directly in other modules.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import aiosqlite

from config import DB_PATH


@asynccontextmanager
async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    """Yield a connected aiosqlite database connection.

    Usage::

        async with get_db() as db:
            await db.execute(...)
            await db.commit()
    """
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        yield conn
