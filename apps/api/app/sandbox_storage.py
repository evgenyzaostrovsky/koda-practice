import hashlib
import os
import re
import uuid
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
from fastapi import HTTPException, UploadFile

from .auth_backend import SUPABASE_ANON_KEY, SUPABASE_URL, rest

BUCKET = os.environ.get("KODA_SANDBOX_BUCKET", "koda-sandbox")
MAX_FILE_BYTES = 20 * 1024 * 1024
USER_QUOTA_BYTES = 100 * 1024 * 1024
CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def require_owner(user):
    if not user:
        raise HTTPException(503, "Песочница требует настроенной авторизации")
    return user


def safe_name(value: str) -> str:
    name = (value or "").strip()
    if not name or name in {".", ".."}:
        raise HTTPException(400, "Укажите имя CSV-файла")
    if CONTROL_CHARS.search(name) or "/" in name or "\\" in name or ".." in name:
        raise HTTPException(400, "Имя файла содержит недопустимые символы")
    if not name.casefold().endswith(".csv"):
        raise HTTPException(415, "Разрешены только файлы .csv")
    if len(name) > 180:
        raise HTTPException(400, "Имя файла слишком длинное")
    return name


def public_file(row: dict) -> dict:
    return {
        "id": row["id"], "name": row["name"], "logicalPath": row["logical_path"],
        "sizeBytes": row["size_bytes"], "mimeType": row["mime_type"],
        "createdAt": row["created_at"], "updatedAt": row["updated_at"],
        "version": row["content_hash"],
    }


def list_files(user) -> list[dict]:
    owner = require_owner(user)
    rows = rest(owner, "sandbox_files", params={"user_id": f"eq.{owner['id']}", "select": "*", "order": "created_at.asc"}) or []
    return [public_file(row) for row in rows]


def _storage_request(user, storage_key: str, method: str, content: bytes | None = None):
    headers = {"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {user['token']}"}
    if content is not None:
        headers["Content-Type"] = "text/csv"
    url = f"{SUPABASE_URL}/storage/v1/object/{quote(BUCKET)}/{quote(storage_key, safe='/')}"
    try:
        response = httpx.request(method, url, headers=headers, content=content, timeout=45)
    except Exception as exc:
        raise HTTPException(503, "Хранилище файлов временно недоступно") from exc
    if response.status_code >= 400:
        raise HTTPException(502, "Не удалось выполнить операцию с хранилищем")
    return response


async def create_file(user, upload: UploadFile) -> dict:
    owner = require_owner(user)
    name = safe_name(upload.filename or "")
    content = await upload.read(MAX_FILE_BYTES + 1)
    if not content:
        raise HTTPException(400, "CSV-файл пуст")
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, "Размер CSV превышает 20 МБ")
    existing = rest(owner, "sandbox_files", params={"user_id": f"eq.{owner['id']}", "select": "name,size_bytes"}) or []
    if sum(int(row["size_bytes"]) for row in existing) + len(content) > USER_QUOTA_BYTES:
        raise HTTPException(413, "Превышена квота песочницы 100 МБ")
    used = {row["name"].casefold() for row in existing}
    if name.casefold() in used:
        stem, ext = name[:-4], name[-4:]
        index = 2
        while f"{stem}_{index}{ext}".casefold() in used:
            index += 1
        name = f"{stem}_{index}{ext}"
    file_id = str(uuid.uuid4())
    storage_key = f"{owner['id']}/{file_id}"
    digest = hashlib.sha256(content).hexdigest()
    _storage_request(owner, storage_key, "POST", content)
    timestamp = datetime.now(timezone.utc).isoformat()
    payload = {"id": file_id, "user_id": owner["id"], "name": name, "logical_path": f"/datasets/{name}", "storage_key": storage_key, "size_bytes": len(content), "mime_type": "text/csv", "content_hash": digest, "created_at": timestamp, "updated_at": timestamp}
    try:
        rows = rest(owner, "sandbox_files", "POST", payload, prefer="return=representation") or []
    except Exception:
        _storage_request(owner, storage_key, "DELETE")
        raise
    return public_file(rows[0] if rows else payload)


def owned_row(user, file_id: str) -> dict:
    owner = require_owner(user)
    rows = rest(owner, "sandbox_files", params={"id": f"eq.{file_id}", "user_id": f"eq.{owner['id']}", "select": "*"}) or []
    if not rows:
        raise HTTPException(404, "Файл не найден")
    return rows[0]


def file_content(user, file_id: str) -> tuple[bytes, str]:
    row = owned_row(user, file_id)
    return _storage_request(user, row["storage_key"], "GET").content, row["name"]


def rename_file(user, file_id: str, requested_name: str) -> dict:
    owner = require_owner(user)
    row = owned_row(owner, file_id)
    name = safe_name(requested_name)
    conflicts = rest(owner, "sandbox_files", params={"user_id": f"eq.{owner['id']}", "name": f"eq.{name}", "id": f"neq.{file_id}", "select": "id"}) or []
    if conflicts:
        raise HTTPException(409, "Файл с таким именем уже существует")
    rows = rest(owner, "sandbox_files", "PATCH", {"name": name, "logical_path": f"/datasets/{name}"}, params={"id": f"eq.{file_id}", "user_id": f"eq.{owner['id']}"}, prefer="return=representation") or []
    return public_file(rows[0] if rows else {**row, "name": name, "logical_path": f"/datasets/{name}"})


def delete_file(user, file_id: str) -> None:
    owner = require_owner(user)
    row = owned_row(owner, file_id)
    _storage_request(owner, row["storage_key"], "DELETE")
    rest(owner, "sandbox_files", "DELETE", params={"id": f"eq.{file_id}", "user_id": f"eq.{owner['id']}"}, prefer="return=minimal")
