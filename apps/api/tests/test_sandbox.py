import asyncio
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

import pytest
from fastapi import HTTPException, UploadFile

from app import sandbox_storage as storage

USER = {"id": "11111111-1111-1111-1111-111111111111", "token": "token-a"}
OTHER = {"id": "22222222-2222-2222-2222-222222222222", "token": "token-b"}


class MemoryBackend:
    def __init__(self): self.rows=[]; self.objects={}; self.empty_patch=False; self.empty_delete=False
    def rest(self,user,path,method="GET",json=None,params=None,prefer=None):
        rows=[row for row in self.rows if row["user_id"]==user["id"]]
        if params:
            for key,value in params.items():
                if key in {"select","order"}: continue
                op,target=value.split(".",1)
                rows=[row for row in rows if (str(row.get(key))==target)==(op=="eq")]
        if method=="GET": return rows
        if method=="POST":
            now=datetime.now(timezone.utc).isoformat();row={**json,"created_at":now,"updated_at":now};self.rows.append(row);return[row]
        if method=="PATCH":
            if self.empty_patch:return []
            for row in rows:row.update(json);row["updated_at"]=datetime.now(timezone.utc).isoformat()
            return rows
        if method=="DELETE":
            if self.empty_delete:return []
            for row in rows:self.rows.remove(row)
            return rows
    def object(self,user,key,method,content=None):
        class Response: pass
        response=Response()
        if not key.startswith(user["id"]+"/"): raise HTTPException(404,"not found")
        if method=="POST": self.objects[key]=content;response.content=b""
        elif method=="GET":
            if key not in self.objects:raise HTTPException(404,"not found")
            response.content=self.objects[key]
        elif method=="DELETE":self.objects.pop(key,None);response.content=b""
        return response


@pytest.fixture
def memory(monkeypatch):
    backend=MemoryBackend();monkeypatch.setattr(storage,"rest",backend.rest);monkeypatch.setattr(storage,"_storage_request",backend.object);return backend


def upload(name,content="city,sales\nМосква,10\n".encode("utf-8")):
    return UploadFile(filename=name,file=BytesIO(content))


def create(memory,name="sales.csv",content="city,sales\nМосква,10\n".encode("utf-8")):
    return asyncio.run(storage.create_file(USER,upload(name,content)))


def test_upload_list_content_and_stable_path(memory):
    item=create(memory)
    assert item["logicalPath"]=="/datasets/sales.csv"
    assert storage.list_files(USER)==[item]
    body,name=storage.file_content(USER,item["id"])
    assert body.startswith(b"city,sales") and name=="sales.csv"


@pytest.mark.parametrize("name",["data.txt","../sales.csv","/sales.csv","dir\\sales.csv","bad\x00.csv",""])
def test_rejects_unsupported_or_unsafe_names(memory,name):
    with pytest.raises(HTTPException):create(memory,name)


def test_rejects_empty_and_oversized_files(memory):
    with pytest.raises(HTTPException) as empty:create(memory,"empty.csv",b"")
    assert empty.value.status_code==400
    with pytest.raises(HTTPException) as big:create(memory,"big.csv",b"x"*(storage.MAX_FILE_BYTES+1))
    assert big.value.status_code==413


def test_collision_gets_safe_unique_name(memory):
    assert create(memory)["name"]=="sales.csv"
    second=create(memory)
    assert second["name"]=="sales_2.csv" and second["logicalPath"]=="/datasets/sales_2.csv"


def test_rename_updates_logical_path_but_not_storage_key(memory):
    item=create(memory);before=memory.rows[0]["storage_key"]
    renamed=storage.rename_file(USER,item["id"],"продажи август.csv")
    assert renamed["logicalPath"]=="/datasets/продажи август.csv"
    assert memory.rows[0]["storage_key"]==before


def test_rename_rejects_collision(memory):
    first=create(memory,"one.csv");second=create(memory,"two.csv")
    with pytest.raises(HTTPException) as error:storage.rename_file(USER,second["id"],first["name"])
    assert error.value.status_code==409


def test_rename_does_not_fake_success_when_patch_updates_nothing(memory):
    item=create(memory);memory.empty_patch=True
    with pytest.raises(HTTPException) as error:storage.rename_file(USER,item["id"],"new.csv")
    assert error.value.status_code==502
    assert memory.rows[0]["name"]=="sales.csv"


def test_delete_removes_object_and_metadata(memory):
    item=create(memory);storage.delete_file(USER,item["id"])
    assert storage.list_files(USER)==[] and memory.objects=={}


def test_delete_restores_storage_when_metadata_delete_is_not_confirmed(memory):
    item=create(memory);key=memory.rows[0]["storage_key"];original=memory.objects[key];memory.empty_delete=True
    with pytest.raises(HTTPException) as error:storage.delete_file(USER,item["id"])
    assert error.value.status_code==502
    assert memory.objects[key]==original
    assert storage.list_files(USER)==[item]


def test_other_user_cannot_access_uuid(memory):
    item=create(memory)
    with pytest.raises(HTTPException) as error:storage.file_content(OTHER,item["id"])
    assert error.value.status_code==404


def test_requires_authenticated_owner(memory):
    with pytest.raises(HTTPException) as error:storage.list_files(None)
    assert error.value.status_code==503


def test_migration_creates_private_bucket_and_owner_policies():
    sql=(Path(__file__).parents[3]/"supabase/migrations/202608110002_sandbox_files.sql").read_text(encoding="utf-8")
    assert "values('koda-sandbox','koda-sandbox',false" in sql
    assert "unique(user_id,logical_path)" in sql
    assert "auth.uid()" in sql and "storage.objects" in sql
