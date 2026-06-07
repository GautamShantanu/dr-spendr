import { useState, useEffect, useRef } from "react";
import { Paperclip, X, ImagePlus, Loader2 } from "lucide-react";
import { supabase } from "../supabaseClient";
import { MAX_PHOTOS } from "../lib/constants";
import { compressImage } from "../lib/helpers";

export function PhotoPicker({ photos, setPhotos, existing = [], onRemoveExisting }) {
  const inRef = useRef(null);
  const remaining = MAX_PHOTOS - existing.length - photos.length;
  const pick = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, Math.max(0, remaining));
    e.target.value = "";
    for (const f of files) {
      const blob = await compressImage(f);
      setPhotos((prev) => prev.length + existing.length >= MAX_PHOTOS ? prev : [...prev, { blob, url: URL.createObjectURL(blob) }]);
    }
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {existing.map((p) => (
        <div key={p} className="relative">
          <div className="w-14 h-14 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center"><Paperclip className="w-5 h-5 text-slate-400" /></div>
          {onRemoveExisting && <button type="button" onClick={() => onRemoveExisting(p)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center"><X className="w-3 h-3" /></button>}
        </div>
      ))}
      {photos.map((p, i) => (
        <div key={p.url} className="relative">
          <img src={p.url} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
          <button type="button" onClick={() => { URL.revokeObjectURL(p.url); setPhotos((prev) => prev.filter((_, j) => j !== i)); }} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center"><X className="w-3 h-3" /></button>
        </div>
      ))}
      {remaining > 0 && (
        <button type="button" onClick={() => inRef.current?.click()} className="w-14 h-14 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 flex flex-col items-center justify-center gap-0.5">
          <ImagePlus className="w-5 h-5" /><span className="text-[9px] font-medium">Photo</span>
        </button>
      )}
      <input ref={inRef} type="file" accept="image/*" multiple className="hidden" onChange={pick} />
    </div>
  );
}

export function AttachmentViewer({ paths, onClose }) {
  const [urls, setUrls] = useState(null);
  useEffect(() => {
    (async () => {
      const out = [];
      for (const p of paths) {
        const { data } = await supabase.storage.from("receipts").createSignedUrl(p, 3600);
        if (data?.signedUrl) out.push(data.signedUrl);
      }
      setUrls(out);
    })();
  }, [paths]);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-lg w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end"><button onClick={onClose} className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20"><X className="w-5 h-5" /></button></div>
        {urls === null ? <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-white" /></div>
          : urls.length === 0 ? <p className="text-center text-white/80 text-sm py-16">Couldn't load photos.</p>
          : urls.map((u) => <img key={u} src={u} alt="Receipt" className="w-full rounded-2xl max-h-[70vh] object-contain bg-black/30" />)}
      </div>
    </div>
  );
}
