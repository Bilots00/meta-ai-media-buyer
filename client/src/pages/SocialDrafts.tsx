import { useState, type ElementType } from "react";
import { Instagram, Facebook, MessageSquare, Clock, Pencil, Bot, Inbox, Check, Trash2, FileText, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

const PLATFORMS: Record<string, { label: string; icon: ElementType; color: string }> = {
  instagram: { label: "Instagram", icon: Instagram, color: "oklch(0.65 0.2 340)" },
  facebook: { label: "Facebook", icon: Facebook, color: "oklch(0.5 0.18 265)" },
  pinterest: { label: "Pinterest", icon: MessageSquare, color: "oklch(0.6 0.22 25)" },
  shopify_blog: { label: "Blog Shopify", icon: FileText, color: "oklch(0.7 0.15 150)" },
  x: { label: "X (Twitter)", icon: Twitter, color: "oklch(0.75 0.02 260)" },
};
const STATUS_LABEL: Record<string, string> = { draft: "Bozza", scheduled: "Pianificato", published: "Pubblicato", rejected: "Rifiutato" };

export default function SocialDrafts() {
  const utils = trpc.useUtils();
  const drafts = trpc.social.draftsList.useQuery(undefined, { refetchInterval: 8000 });
  const update = trpc.social.draftUpdate.useMutation({ onSuccess: () => utils.social.draftsList.invalidate() });
  const del = trpc.social.draftDelete.useMutation({ onSuccess: () => utils.social.draftsList.invalidate() });

  type Draft = NonNullable<typeof drafts.data>[number];
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<{ title: string; caption: string; hashtags: string }>({ title: "", caption: "", hashtags: "" });

  const list: Draft[] = drafts.data ?? [];
  const startEdit = (d: Draft) => { setEditId(d.id); setForm({ title: d.title ?? "", caption: d.caption ?? "", hashtags: d.hashtags ?? "" }); };
  const saveEdit = () => { if (editId == null) return; update.mutate({ id: editId, ...form }); setEditId(null); };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 flex items-center gap-4" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}><Inbox className="w-6 h-6 text-white" /></div>
        <div>
          <h1 className="text-xl font-bold">Bozze da revisionare</h1>
          <p className="text-sm text-muted-foreground">Contenuti generati dall'AI in attesa della tua approvazione — modificabili e pianificabili</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs px-3 py-2 rounded-xl" style={{ background: "oklch(0.65 0.2 265 / 0.12)", border: "1px solid oklch(0.65 0.2 265 / 0.3)", color: "oklch(0.75 0.15 265)" }}><Bot className="w-3.5 h-3.5" /> {list.length} bozze</div>
      </div>

      {list.length === 0 && (
        <div className="rounded-2xl p-10 text-center text-sm text-muted-foreground" style={{ background: "oklch(0.13 0.015 260)", border: "1px dashed oklch(0.22 0.015 260)" }}>
          Nessuna bozza ancora. Genera contenuti da <b>Crea Post</b> o lascia lavorare l'AI Manager: le bozze appariranno qui. ✨
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((d) => {
          const p = PLATFORMS[d.platform] ?? PLATFORMS.instagram; const Icon = p.icon;
          const editing = editId === d.id;
          return (
            <div key={d.id} className="rounded-2xl p-5 flex flex-col" style={{ background: "oklch(0.14 0.015 260)", border: "1px solid oklch(0.2 0.015 260)" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, background: `${p.color}22`, border: `1px solid ${p.color}44` }}><Icon className="w-3.5 h-3.5" style={{ color: p.color }} /></div>
                <span className="text-sm font-medium">{p.label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ background: "oklch(0.2 0.02 260)", color: "oklch(0.7 0.02 260)" }}>{d.format}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.2 265 / 0.15)", color: "oklch(0.75 0.15 265)" }}>{STATUS_LABEL[d.status] ?? d.status}</span>
              </div>

              {editing ? (
                <div className="space-y-2">
                  <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Titolo" className="w-full text-sm rounded-lg px-3 py-2 bg-transparent text-foreground" style={{ border: "1px solid oklch(0.22 0.015 260)" }} />
                  <Textarea value={form.caption} onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))} rows={5} placeholder="Caption" className="resize-none text-sm" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.22 0.015 260)" }} />
                  <Textarea value={form.hashtags} onChange={(e) => setForm((f) => ({ ...f, hashtags: e.target.value }))} rows={2} placeholder="#hashtag" className="resize-none text-sm text-primary" style={{ background: "oklch(0.16 0.015 260)", border: "1px solid oklch(0.22 0.015 260)" }} />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 text-white" style={{ background: "var(--gradient-primary)" }} disabled={update.isPending} onClick={saveEdit}><Check className="w-3.5 h-3.5 mr-1" />Salva</Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditId(null)}>Annulla</Button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-sm mb-1">{d.title || "(senza titolo)"}</h3>
                  <p className="text-xs text-muted-foreground flex-1 whitespace-pre-line line-clamp-5">{d.caption || "—"}</p>
                  {d.hashtags && <p className="text-xs text-primary mt-2 line-clamp-2">{d.hashtags}</p>}
                  <div className="flex gap-2 mt-3 pt-3 items-center" style={{ borderTop: "1px solid oklch(0.2 0.015 260)" }}>
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => startEdit(d)}><Pencil className="w-3.5 h-3.5 mr-1" />Modifica</Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-red-400" onClick={() => del.mutate({ id: d.id })}><Trash2 className="w-3.5 h-3.5 mr-1" />Elimina</Button>
                    <Button size="sm" className="h-8 px-3 text-xs text-white ml-auto" style={{ background: "var(--gradient-primary)" }} disabled={update.isPending} onClick={() => update.mutate({ id: d.id, status: "scheduled" })}><Clock className="w-3.5 h-3.5 mr-1" />Approva &amp; Pianifica</Button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
