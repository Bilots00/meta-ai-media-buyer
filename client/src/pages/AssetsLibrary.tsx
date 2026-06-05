import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Image as ImageIcon, Video, FolderOpen, Link2, Search, RefreshCw, ExternalLink, Send, Filter, Sparkles, Grid3x3, List, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface DriveFile { id: string; name: string; mimeType: string; createdTime: string; size?: string; thumbnailLink?: string; }
type ViewMode = "grid" | "list";
type FilterType = "all" | "image" | "video";

function parseFolderId(input: string): string {
  const match = input.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{25,}$/.test(input.trim())) return input.trim();
  return input.trim();
}
function getThumbnailUrl(id: string) { return `https://drive.google.com/thumbnail?id=${id}&sz=w400`; }
function getViewUrl(id: string) { return `https://drive.google.com/file/d/${id}/view`; }
function isVideo(m: string) { return m.startsWith("video/"); }
function isImage(m: string) { return m.startsWith("image/"); }
function formatDate(iso: string) { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }); }

const FOLDER_MIME = "application/vnd.google-apps.folder";

async function listFolder(folderId: string, apiKey: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent("files(id,name,mimeType,createdTime,size,thumbnailLink)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=createdTime+desc&pageSize=1000&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message || `Errore ${res.status}`); }
  const data = await res.json();
  return data.files || [];
}

// Recursively walk subfolders so creative dentro alle sotto-cartelle compaiano tutte
async function fetchDriveFiles(folderId: string, apiKey: string, depth = 0): Promise<DriveFile[]> {
  const items = await listFolder(folderId, apiKey);
  const files: DriveFile[] = [];
  const subfolders: DriveFile[] = [];
  for (const it of items) {
    if (it.mimeType === FOLDER_MIME) subfolders.push(it);
    else files.push(it);
  }
  let all: DriveFile[] = [...files];
  if (depth < 5) {
    for (const sf of subfolders) {
      try { const sub = await fetchDriveFiles(sf.id, apiKey, depth + 1); all = all.concat(sub); } catch {}
    }
  }
  all.sort((a, b) => (b.createdTime || "").localeCompare(a.createdTime || ""));
  return all;
}

function AssetCard({ file, view, onCreatePost }: { file: DriveFile; view: ViewMode; onCreatePost: (f: DriveFile) => void }) {
  const thumb = getThumbnailUrl(file.id);
  const isVid = isVideo(file.mimeType);
  if (view === "list") {
    return (
      <div className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:opacity-90" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }} onClick={() => window.open(getViewUrl(file.id), "_blank")}>
        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 relative" style={{ background: "oklch(0.16 0.015 260)" }}>
          {(isImage(file.mimeType) || isVid) && <img src={thumb} alt={file.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
          {isVid && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><Video className="w-4 h-4 text-white" /></div>}
        </div>
        <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{file.name}</p><p className="text-xs text-muted-foreground">{formatDate(file.createdTime)}</p></div>
        <button onClick={(e) => { e.stopPropagation(); onCreatePost(file); }} className="text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1 shrink-0" style={{ background: "oklch(0.65 0.2 265/0.18)", color: "oklch(0.8 0.1 265)" }} title="Crea post social"><Send className="w-3 h-3" />Post</button>
        <Badge variant="outline" className="text-xs shrink-0">{isVid ? "Video" : isImage(file.mimeType) ? "Immagine" : "File"}</Badge>
      </div>
    );
  }
  return (
    <div className="rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-all" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }} onClick={() => window.open(getViewUrl(file.id), "_blank")}>
      <div className="aspect-square relative overflow-hidden" style={{ background: "oklch(0.12 0.01 260)" }}>
        {(isImage(file.mimeType) || isVid) && <img src={thumb} alt={file.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
        {isVid && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Video className="w-5 h-5 text-white" /></div></div>}
      </div>
      <div className="p-3">
        <p className="text-xs font-medium truncate">{file.name}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-muted-foreground">{formatDate(file.createdTime)}</p>
          <button onClick={(e) => { e.stopPropagation(); onCreatePost(file); }} className="text-xs px-2 py-0.5 rounded-md font-medium flex items-center gap-1" style={{ background: "oklch(0.65 0.2 265/0.18)", color: "oklch(0.8 0.1 265)" }} title="Crea post social"><Send className="w-3 h-3" />Crea post</button>
        </div>
      </div>
    </div>
  );
}

export default function AssetsLibrary() {
  const [location, navigate] = useLocation();
  const isMetaLib = location.includes("/meta/");
  const LS_FOLDER = "assets_library_folder_id";
  const LS_APIKEY = "assets_library_api_key";
  const [folderId, setFolderId] = useState(() => localStorage.getItem(LS_FOLDER) || "");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(LS_APIKEY) || "");
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [connected, setConnected] = useState(false);
  const [folderInput, setFolderInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");

  const handleCreatePost = (f: DriveFile) => {
    localStorage.setItem("db_social_asset", JSON.stringify({ id: f.id, name: f.name, mimeType: f.mimeType, thumb: getThumbnailUrl(f.id), view: getViewUrl(f.id), type: isVideo(f.mimeType) ? "video" : "image" }));
    navigate("/social/create");
  };

  const loadFiles = async (fId: string, aKey: string) => {
    setLoading(true); setError("");
    try {
      const result = await fetchDriveFiles(fId, aKey);
      setFiles(result); setConnected(true);
      toast.success(`${result.length} asset caricati da Google Drive`);
    } catch (e: any) { setError(e.message || "Errore"); toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (folderId && apiKey) loadFiles(folderId, apiKey); }, []);

  const handleSave = () => {
    if (!apiKeyInput.trim() || !folderInput.trim()) { toast.error("Inserisci API key e URL cartella"); return; }
    const fId = parseFolderId(folderInput);
    localStorage.setItem(LS_FOLDER, fId); localStorage.setItem(LS_APIKEY, apiKeyInput.trim());
    setFolderId(fId); setApiKey(apiKeyInput.trim()); loadFiles(fId, apiKeyInput.trim());
  };

  const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || (filter === "video" ? isVideo(f.mimeType) : isImage(f.mimeType))));

  if (!connected && !folderId) return (
    <div className="space-y-6 max-w-xl mx-auto">
      <h1 className="text-xl font-bold">Library — My Assets</h1>
      <p className="text-sm text-muted-foreground">Collega la cartella Google Drive dove n8n carica le creative</p>
      <div className="space-y-3 rounded-2xl p-5" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <Input placeholder="Google API Key (AIzaSy...)" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} />
        <Input placeholder="URL cartella Drive: https://drive.google.com/drive/folders/..." value={folderInput} onChange={e => setFolderInput(e.target.value)} />
        <Button onClick={handleSave} className="w-full text-white" style={{ background: "linear-gradient(135deg, oklch(0.55 0.22 265), oklch(0.45 0.2 290))" }}>
          <Link2 className="w-4 h-4 mr-2" /> Connetti & Carica Assets
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div><h1 className="text-xl font-bold">My Assets</h1><p className="text-sm text-muted-foreground">{isMetaLib ? "META ADS" : "Social"} · Google Drive</p></div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => loadFiles(folderId, apiKey)} disabled={loading} className="gap-2 text-white" style={{ background: "linear-gradient(135deg, oklch(0.55 0.22 265), oklch(0.45 0.2 290))" }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Aggiorna
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { localStorage.removeItem(LS_FOLDER); localStorage.removeItem(LS_APIKEY); setConnected(false); setFolderId(""); setApiKey(""); setFiles([]); }}>
            Disconnetti
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[{label:"Totale",val:files.length},{label:"Immagini",val:files.filter(f=>isImage(f.mimeType)).length},{label:"Video",val:files.filter(f=>isVideo(f.mimeType)).length}].map(({label,val}) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className="text-2xl font-bold">{val}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca..." className="pl-9" /></div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "oklch(0.14 0.015 260)" }}>
          {(["all","image","video"] as FilterType[]).map(f => <button key={f} onClick={() => setFilter(f)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: filter===f ? "oklch(0.65 0.2 265/0.2)" : "transparent", color: filter===f ? "oklch(0.8 0.1 265)" : "oklch(0.5 0.02 260)" }}>{f==="all"?"Tutti":f==="image"?"Immagini":"Video"}</button>)}
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "oklch(0.14 0.015 260)" }}>
          <button onClick={() => setView("grid")} className="p-1.5 rounded-lg" style={{ background: view==="grid" ? "oklch(0.65 0.2 265/0.2)" : "transparent" }}><Grid3x3 className="w-4 h-4" /></button>
          <button onClick={() => setView("list")} className="p-1.5 rounded-lg" style={{ background: view==="list" ? "oklch(0.65 0.2 265/0.2)" : "transparent" }}><List className="w-4 h-4" /></button>
        </div>
      </div>
      {error && <div className="rounded-2xl p-4 flex gap-3" style={{ background: "oklch(0.2 0.05 25/0.3)", border: "1px solid oklch(0.55 0.22 25/0.4)" }}><AlertCircle className="w-5 h-5 text-red-400 shrink-0" /><p className="text-sm text-red-400">{error}</p></div>}
      {loading && <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{Array.from({length:8}).map((_,i) => <div key={i} className="rounded-2xl aspect-square animate-pulse" style={{ background: "oklch(0.14 0.015 260)" }} />)}</div>}
      {!loading && connected && (filtered.length === 0
        ? <div className="text-center py-16"><FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" /><p className="text-muted-foreground">{files.length === 0 ? "Cartella vuota — avvia il workflow n8n" : "Nessun risultato"}</p></div>
        : view === "grid"
          ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{filtered.map(f => <AssetCard key={f.id} file={f} view="grid" onCreatePost={handleCreatePost} />)}</div>
          : <div className="space-y-2">{filtered.map(f => <AssetCard key={f.id} file={f} view="list" onCreatePost={handleCreatePost} />)}</div>
      )}
    </div>
  );
           }
