"""Routes pour les documents (upload, download, suppression)."""

import hashlib
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from fastapi.responses import Response

from app.domain.entities.document import Document
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_current_user,
    get_document_repository,
    get_key_manager,
)
from app.infrastructure.api.schemas.document_schemas import (
    DocumentListResponse,
    DocumentResponse,
)
from app.infrastructure.persistence.repositories.sqlalchemy_document_repo import (
    SQLAlchemyDocumentRepo,
)
from app.infrastructure.security.encryption import decrypt, encrypt
from app.infrastructure.security.key_manager import KeyManager

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = Path("uploads")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 Mo
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}


def _entity_to_response(doc: Document) -> DocumentResponse:
    return DocumentResponse(
        id=str(doc.id),
        cabinet_id=str(doc.cabinet_id),
        entity_type=doc.entity_type,
        entity_id=str(doc.entity_id),
        original_name=doc.original_name,
        mime_type=doc.mime_type,
        size_bytes=doc.size_bytes,
        checksum_sha256=doc.checksum_sha256,
        uploaded_by=str(doc.uploaded_by),
        created_at=doc.created_at,
    )


@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    file: UploadFile,
    entity_type: str,
    entity_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyDocumentRepo = Depends(get_document_repository),
    km: KeyManager = Depends(get_key_manager),
):
    """Upload un document chiffré lié à une entité (patient, protocole, etc.)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    # Validation type MIME
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de fichier non autorisé: {file.content_type}. Types acceptés: PDF, JPEG, PNG, GIF, WebP.",
        )

    # Lecture et validation taille
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fichier trop volumineux ({len(content)} octets). Maximum: {MAX_FILE_SIZE} octets (10 Mo).",
        )

    # Checksum du fichier original
    checksum = hashlib.sha256(content).hexdigest()

    # Chiffrement du contenu
    cabinet_key = km.get_cabinet_key(auth.cabinet_id)
    encrypted_content = encrypt(content.decode("latin-1"), cabinet_key)

    # Stockage sur disque (chiffré)
    cabinet_dir = UPLOAD_DIR / str(auth.cabinet_id)
    cabinet_dir.mkdir(parents=True, exist_ok=True)

    file_id = uuid4()
    storage_path = str(cabinet_dir / f"{file_id}.enc")
    Path(storage_path).write_bytes(encrypted_content)

    # Enregistrement en BDD
    doc = Document(
        id=file_id,
        cabinet_id=auth.cabinet_id,
        entity_type=entity_type,
        entity_id=entity_id,
        original_name=file.filename or "document",
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        storage_path=storage_path,
        checksum_sha256=checksum,
        uploaded_by=auth.user_id,
    )
    doc = await repo.create(doc)
    return _entity_to_response(doc)


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    entity_type: str,
    entity_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyDocumentRepo = Depends(get_document_repository),
):
    """Liste les documents liés à une entité."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    docs = await repo.list_by_entity(entity_type, entity_id)
    return DocumentListResponse(items=[_entity_to_response(d) for d in docs], total=len(docs))


@router.get("/{document_id}")
async def download_document(
    document_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyDocumentRepo = Depends(get_document_repository),
    km: KeyManager = Depends(get_key_manager),
):
    """Télécharge un document déchiffré."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    doc = await repo.get_by_id(document_id)
    if not doc or doc.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document introuvable",
        )

    # Lecture et déchiffrement
    storage_file = Path(doc.storage_path)
    if not storage_file.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier introuvable sur le stockage",
        )

    encrypted_content = storage_file.read_bytes()
    cabinet_key = km.get_cabinet_key(auth.cabinet_id)
    decrypted_str = decrypt(encrypted_content, cabinet_key)
    decrypted_content = decrypted_str.encode("latin-1")

    return Response(
        content=decrypted_content,
        media_type=doc.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{doc.original_name}"'},
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyDocumentRepo = Depends(get_document_repository),
):
    """Supprime un document."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    doc = await repo.get_by_id(document_id)
    if not doc or doc.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document introuvable",
        )

    # Suppression du fichier sur disque
    storage_file = Path(doc.storage_path)
    if storage_file.exists():
        storage_file.unlink()

    await repo.delete(document_id)
