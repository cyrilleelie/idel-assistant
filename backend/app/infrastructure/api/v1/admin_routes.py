"""Admin BDD routes — raw database introspection and CRUD for dev purposes."""

import logging
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import MetaData, delete, func, insert, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.logging.log_handler import get_log_handler
from app.infrastructure.persistence.database import async_session_factory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

# ──────────────────────────────── Dependency ────────────────────────────────

async def get_admin_db():
    """Yield a session with RLS disabled for admin introspection."""
    async with async_session_factory() as session:
        try:
            await session.execute(text("SET LOCAL row_security = off"))
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ──────────────────────────────── Helpers ────────────────────────────────

_metadata_cache: MetaData | None = None


async def _get_metadata(session: AsyncSession) -> MetaData:
    """Reflect database metadata (cached after first call)."""
    global _metadata_cache
    if _metadata_cache is None:
        md = MetaData()
        conn = await session.connection()
        await conn.run_sync(md.reflect)
        _metadata_cache = md
    return _metadata_cache


_SYSTEM_TABLES = {"alembic_version"}


def _serialize_value(val: Any) -> Any:
    """Convert DB values to JSON-serializable types."""
    if val is None:
        return None
    if isinstance(val, UUID):
        return str(val)
    if isinstance(val, Decimal):
        return str(val)
    if isinstance(val, bytes):
        return val.hex()
    if isinstance(val, (list, dict)):
        return val
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return val


def _get_label_column(table) -> str:
    """Heuristic to find the best display column for FK dropdown labels."""
    col_names = [c.name for c in table.columns]
    for candidate in ["name", "label", "email", "code", "invoice_number"]:
        if candidate in col_names:
            return candidate
    if "first_name" in col_names and "last_name" in col_names:
        return "first_name||' '||last_name"
    return "id"


def _validate_table(metadata: MetaData, table_name: str):
    """Validate table name against reflected metadata (whitelist)."""
    if table_name in _SYSTEM_TABLES:
        raise HTTPException(status_code=403, detail=f"Access denied to system table '{table_name}'")
    if table_name not in metadata.tables:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")
    return metadata.tables[table_name]


# ──────────────────────────────── Endpoints ────────────────────────────────

@router.get("/tables")
async def list_tables(session: AsyncSession = Depends(get_admin_db)):
    """List all user tables with row count."""
    md = await _get_metadata(session)
    tables = []
    for name, table in sorted(md.tables.items()):
        if name in _SYSTEM_TABLES:
            continue
        count_result = await session.execute(
            select(func.count()).select_from(table)
        )
        tables.append({
            "name": name,
            "row_count": count_result.scalar(),
        })
    return tables


@router.get("/tables/{table_name}/schema")
async def get_table_schema(
    table_name: str,
    session: AsyncSession = Depends(get_admin_db),
):
    """Return column definitions for a table."""
    md = await _get_metadata(session)
    table = _validate_table(md, table_name)

    columns = []
    for col in table.columns:
        col_info: dict[str, Any] = {
            "name": col.name,
            "type": str(col.type),
            "nullable": col.nullable,
            "is_pk": col.primary_key,
            "has_default": col.default is not None or col.server_default is not None,
        }
        # FK info
        if col.foreign_keys:
            fk = next(iter(col.foreign_keys))
            col_info["fk_table"] = fk.column.table.name
            col_info["fk_column"] = fk.column.name
        columns.append(col_info)

    return {"table": table_name, "columns": columns}


@router.get("/tables/{table_name}/rows")
async def get_table_rows(
    table_name: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    sort: str | None = None,
    order: str = Query("asc", pattern="^(asc|desc)$"),
    session: AsyncSession = Depends(get_admin_db),
):
    """Paginated rows for a table."""
    md = await _get_metadata(session)
    table = _validate_table(md, table_name)

    # Count
    count_result = await session.execute(
        select(func.count()).select_from(table)
    )
    total = count_result.scalar()

    # Query
    stmt = select(table)

    if sort:
        if sort not in [c.name for c in table.columns]:
            raise HTTPException(status_code=400, detail=f"Invalid sort column '{sort}'")
        sort_col = table.c[sort]
        stmt = stmt.order_by(sort_col.desc() if order == "desc" else sort_col.asc())
    else:
        # Default: order by first PK column
        pk_cols = [c for c in table.columns if c.primary_key]
        if pk_cols:
            stmt = stmt.order_by(pk_cols[0].asc())

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await session.execute(stmt)
    rows = []
    for row in result:
        rows.append({col.name: _serialize_value(row[i]) for i, col in enumerate(table.columns)})

    return {
        "rows": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/tables/{table_name}/rows", status_code=201)
async def create_row(
    table_name: str,
    body: dict[str, Any],
    session: AsyncSession = Depends(get_admin_db),
):
    """Insert a new row."""
    md = await _get_metadata(session)
    table = _validate_table(md, table_name)

    valid_cols = {c.name for c in table.columns}
    filtered = {k: v for k, v in body.items() if k in valid_cols}

    if not filtered:
        raise HTTPException(status_code=400, detail="No valid columns provided")

    stmt = insert(table).values(**filtered).returning(table)
    result = await session.execute(stmt)
    created = result.fetchone()

    return {col.name: _serialize_value(created[i]) for i, col in enumerate(table.columns)}


@router.patch("/tables/{table_name}/rows/{row_id}")
async def update_row(
    table_name: str,
    row_id: str,
    body: dict[str, Any],
    session: AsyncSession = Depends(get_admin_db),
):
    """Partial update of a row by its PK (id column)."""
    md = await _get_metadata(session)
    table = _validate_table(md, table_name)

    if "id" not in [c.name for c in table.columns]:
        raise HTTPException(status_code=400, detail="Table has no 'id' column")

    valid_cols = {c.name for c in table.columns}
    filtered = {k: v for k, v in body.items() if k in valid_cols and k != "id"}

    if not filtered:
        raise HTTPException(status_code=400, detail="No valid columns to update")

    stmt = (
        update(table)
        .where(table.c.id == row_id)
        .values(**filtered)
        .returning(table)
    )
    result = await session.execute(stmt)
    updated = result.fetchone()

    if not updated:
        raise HTTPException(status_code=404, detail="Row not found")

    return {col.name: _serialize_value(updated[i]) for i, col in enumerate(table.columns)}


@router.delete("/tables/{table_name}/rows/{row_id}", status_code=204)
async def delete_row(
    table_name: str,
    row_id: str,
    session: AsyncSession = Depends(get_admin_db),
):
    """Delete a row by its PK."""
    md = await _get_metadata(session)
    table = _validate_table(md, table_name)

    if "id" not in [c.name for c in table.columns]:
        raise HTTPException(status_code=400, detail="Table has no 'id' column")

    stmt = delete(table).where(table.c.id == row_id)
    result = await session.execute(stmt)

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Row not found")


@router.delete("/tables/{table_name}/rows", status_code=204)
async def truncate_table(
    table_name: str,
    session: AsyncSession = Depends(get_admin_db),
):
    """Delete all rows from a table (CASCADE to dependent tables)."""
    md = await _get_metadata(session)
    _validate_table(md, table_name)
    await session.execute(text(f"TRUNCATE TABLE {table_name} CASCADE"))


@router.get("/tables/{table_name}/fk-options/{column_name}")
async def get_fk_options(
    table_name: str,
    column_name: str,
    session: AsyncSession = Depends(get_admin_db),
):
    """Return id+label pairs for a FK column's referenced table (max 500)."""
    md = await _get_metadata(session)
    table = _validate_table(md, table_name)

    # Find the column and its FK
    col = None
    for c in table.columns:
        if c.name == column_name:
            col = c
            break
    if col is None:
        raise HTTPException(status_code=404, detail=f"Column '{column_name}' not found")

    if not col.foreign_keys:
        raise HTTPException(status_code=400, detail=f"Column '{column_name}' is not a foreign key")

    fk = next(iter(col.foreign_keys))
    ref_table = md.tables[fk.column.table.name]
    label_expr = _get_label_column(ref_table)

    # Build query with raw SQL for the label expression
    if "||" in label_expr:
        # Concatenation expression (e.g. first_name||' '||last_name)
        query = text(
            f"SELECT id::text, ({label_expr}) AS label "
            f"FROM {ref_table.name} ORDER BY label LIMIT 500"
        )
    else:
        query = text(
            f"SELECT id::text, {label_expr}::text AS label "
            f"FROM {ref_table.name} ORDER BY label LIMIT 500"
        )

    result = await session.execute(query)
    return [{"id": row[0], "label": row[1]} for row in result]


# ──────────────────────────────── Logs endpoints ────────────────────────────────


@router.get("/logs")
async def get_logs(
    level: str | None = Query(None, description="Niveau minimum (DEBUG, INFO, WARNING, ERROR, CRITICAL)"),
    source: str | None = Query(None, description="'backend', 'frontend' ou 'all'"),
    limit: int = Query(200, ge=1, le=1000),
):
    """Retourne les entrées récentes du buffer de logs en mémoire."""
    handler = get_log_handler()
    entries = handler.get_entries(min_level=level, source_filter=source, limit=limit)
    return {"entries": entries, "count": len(entries)}


class FrontendLogEntry(BaseModel):
    timestamp: str
    level: str
    logger: str
    message: str


@router.post("/logs/frontend", status_code=201)
async def receive_frontend_logs(body: list[FrontendLogEntry]):
    """Reçoit des entrées de log depuis le frontend et les stocke dans le buffer."""
    handler = get_log_handler()
    for entry in body:
        handler.add_frontend_entry(
            timestamp=entry.timestamp,
            level=entry.level,
            logger=entry.logger,
            message=entry.message,
        )
    return {"accepted": len(body)}
