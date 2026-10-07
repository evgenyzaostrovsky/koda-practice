from fastapi import APIRouter, Request, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from ..auth_backend import current_user
from ..sandbox_storage import create_file, delete_file, file_content, list_files, rename_file

router = APIRouter()
class SandboxRenameIn(BaseModel): name: str

@router.get('/sandbox/files')
def sandbox_files(request:Request):
    return list_files(current_user(request))
@router.post('/sandbox/files',status_code=201)
async def sandbox_upload(request:Request,file:UploadFile=File(...)):
    return await create_file(current_user(request),file)
@router.get('/sandbox/files/{file_id}/content')
def sandbox_content(file_id:str,request:Request):
    content,name=file_content(current_user(request),file_id)
    return Response(content,media_type='text/csv',headers={'Content-Disposition':f'attachment; filename="{name.encode("ascii","ignore").decode() or "dataset.csv"}"'})
@router.patch('/sandbox/files/{file_id}')
def sandbox_rename(file_id:str,body:SandboxRenameIn,request:Request):
    return rename_file(current_user(request),file_id,body.name)
@router.delete('/sandbox/files/{file_id}',status_code=204)
def sandbox_delete(file_id:str,request:Request):
    delete_file(current_user(request),file_id)
    return Response(status_code=204)
