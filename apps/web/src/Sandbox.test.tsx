import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sandbox } from "./Sandbox";

let files = [{id:"f1",name:"sales.csv",logicalPath:"/datasets/sales.csv",sizeBytes:24,mimeType:"text/csv",createdAt:"now",updatedAt:"now",version:"hash"}];
const apiMock=vi.fn((path:string,init?:RequestInit)=>{if(path==="/sandbox/files")return Promise.resolve(files);if(init?.method==="PATCH"){files=[{...files[0],name:"new.csv",logicalPath:"/datasets/new.csv"}];return Promise.resolve(files[0])}if(init?.method==="DELETE"){files=[];return Promise.resolve(undefined)}return Promise.resolve({})});
vi.mock("./api",()=>({api:(path:string,init?:RequestInit)=>apiMock(path,init),apiResponse:vi.fn(()=>Promise.resolve({arrayBuffer:()=>Promise.resolve(new ArrayBuffer(4))}))}));
vi.mock("./auth",()=>({getAccessToken:()=>"token"}));
const terminate=vi.fn(),run=vi.fn(()=>Promise.resolve({ok:true,stdout:"",plots:[],result:{kind:"dataframe",columns:["city"],index:["0"],data:[["Москва"]],shape:[1,1]}}));
vi.mock("./sandbox-runtime",()=>({SandboxRuntime:class{ready(){return Promise.resolve("0.27.7")}run(){return run()}terminate(){terminate()}}}));
vi.mock("@monaco-editor/react",()=>({default:({value,onChange}:{value:string;onChange:(value:string)=>void})=><textarea aria-label="Редактор Python" value={value} onChange={e=>onChange(e.target.value)}/> }));

class FakeXHR{
  static last:FakeXHR;upload:{onprogress?:(event:{lengthComputable:boolean;loaded:number;total:number})=>void}={};status=201;responseText=JSON.stringify(files[0]);onload?:()=>void;onerror?:()=>void;
  constructor(){FakeXHR.last=this}open(){}setRequestHeader(){}send(){this.upload.onprogress?.({lengthComputable:true,loaded:1,total:1});this.onload?.()}
}

const renderSandbox=()=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Sandbox/></QueryClientProvider>);
describe("sandbox",()=>{
  afterEach(()=>cleanup());
  beforeEach(()=>{files=[{id:"f1",name:"sales.csv",logicalPath:"/datasets/sales.csv",sizeBytes:24,mimeType:"text/csv",createdAt:"now",updatedAt:"now",version:"hash"}];localStorage.clear();apiMock.mockClear();run.mockClear();terminate.mockClear();vi.stubGlobal("XMLHttpRequest",FakeXHR);Object.assign(navigator,{clipboard:{writeText:vi.fn().mockResolvedValue(undefined)}})});
  it("shows files and copies the logical path",async()=>{renderSandbox();expect(await screen.findByText("/datasets/sales.csv")).toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:/Путь/}));expect(navigator.clipboard.writeText).toHaveBeenCalledWith("/datasets/sales.csv")});
  it("persists code and runs with Ctrl+Enter",async()=>{renderSandbox();const editor=await screen.findByLabelText("Редактор Python");fireEvent.change(editor,{target:{value:"df.head()"}});expect(localStorage.getItem("koda:sandbox-code:v1")).toBe("df.head()");fireEvent.keyDown(editor,{key:"Enter",ctrlKey:true});await waitFor(()=>expect(run).toHaveBeenCalled());expect(await screen.findByText("Москва")).toBeInTheDocument()});
  it("uploads a CSV and reports progress",async()=>{renderSandbox();const input=document.querySelector('input[type="file"]') as HTMLInputElement;fireEvent.change(input,{target:{files:[new File(["a,b\n1,2"],"new.csv",{type:"text/csv"})]}});await waitFor(()=>expect(FakeXHR.last).toBeTruthy());await waitFor(()=>expect(apiMock).toHaveBeenCalledWith("/sandbox/files"))});
  it("renames and deletes after confirmation",async()=>{vi.stubGlobal("prompt",vi.fn(()=>"new.csv"));vi.stubGlobal("confirm",vi.fn(()=>true));renderSandbox();await screen.findByText("sales.csv");fireEvent.click(screen.getByText("Переименовать"));await waitFor(()=>expect(apiMock).toHaveBeenCalledWith("/sandbox/files/f1",expect.objectContaining({method:"PATCH"})));fireEvent.click(screen.getByText("Удалить"));await waitFor(()=>expect(apiMock).toHaveBeenCalledWith("/sandbox/files/f1",expect.objectContaining({method:"DELETE"})))});
  it("restarts the Python environment without clearing code",async()=>{renderSandbox();const editor=await screen.findByLabelText("Редактор Python");fireEvent.change(editor,{target:{value:"answer = 42"}});fireEvent.click(screen.getByText("Перезапустить среду"));expect(terminate).toHaveBeenCalled();expect((screen.getByLabelText("Редактор Python") as HTMLTextAreaElement).value).toBe("answer = 42")});
});
