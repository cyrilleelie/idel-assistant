"""Implémentation SQLAlchemy du DocumentRepository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.document import Document
from app.infrastructure.persistence.models.document_model import DocumentModel


class SQLAlchemyDocumentRepo:
    def __init__(self, session: AsyncSession):
        self._session = session

    def _model_to_entity(self, model: DocumentModel) -> Document:
        return Document(
            id=model.id,
            cabinet_id=model.cabinet_id,
            entity_type=model.entity_type,
            entity_id=model.entity_id,
            original_name=model.original_name,
            mime_type=model.mime_type,
            size_bytes=model.size_bytes,
            storage_path=model.storage_path,
            checksum_sha256=model.checksum_sha256,
            uploaded_by=model.uploaded_by,
            created_at=model.created_at,
        )

    async def get_by_id(self, document_id: UUID) -> Document | None:
        result = await self._session.execute(
            select(DocumentModel).where(DocumentModel.id == document_id)
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def list_by_entity(
        self, entity_type: str, entity_id: UUID
    ) -> list[Document]:
        result = await self._session.execute(
            select(DocumentModel)
            .where(
                DocumentModel.entity_type == entity_type,
                DocumentModel.entity_id == entity_id,
            )
            .order_by(DocumentModel.created_at.desc())
        )
        return [self._model_to_entity(m) for m in result.scalars().all()]

    async def create(self, document: Document) -> Document:
        model = DocumentModel(
            id=document.id,
            cabinet_id=document.cabinet_id,
            entity_type=document.entity_type,
            entity_id=document.entity_id,
            original_name=document.original_name,
            mime_type=document.mime_type,
            size_bytes=document.size_bytes,
            storage_path=document.storage_path,
            checksum_sha256=document.checksum_sha256,
            uploaded_by=document.uploaded_by,
        )
        self._session.add(model)
        await self._session.flush()
        return self._model_to_entity(model)

    async def delete(self, document_id: UUID) -> None:
        result = await self._session.execute(
            select(DocumentModel).where(DocumentModel.id == document_id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Document {document_id} not found")
        await self._session.delete(model)
        await self._session.flush()
