import AdminDisclosure from "@/components/admin/AdminDisclosure";
import type { ChangeEvent, RefObject } from "react";
import { MAX_BULK_IMAGES, formatBytes, type BulkImageItem } from "./admin-question-bank-model";

type Props = {
  busy: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  items: BulkImageItem[];
  notice: string;
  onClear: () => void;
  onFilesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: string) => void;
  onUpload: () => void;
};

export default function BulkImageQuestionUpload({ busy, fileInputRef, items, notice, onClear, onFilesChange, onRemove, onUpload }: Props) {
  const disabled = busy || items.length === 0;

  return (
    <AdminDisclosure title="Bulk image questions">
      <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem", marginBottom: "1rem", background: "var(--color-background-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>Bulk Image Upload</h2>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
              Upload multiple image questions at once (max {MAX_BULK_IMAGES}). Preview before uploading.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button data-ui-button="state" onClick={onClear} disabled={disabled} style={{ padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: disabled ? "default" : "pointer", fontSize: 12, color: "var(--color-text-secondary)", opacity: disabled ? 0.6 : 1 }}>
              Clear
            </button>
            <button data-ui-button="state" onClick={onUpload} disabled={disabled} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: busy ? "#a855f7" : "var(--admin-blue)", color: "#fff", cursor: disabled ? "default" : "pointer", fontSize: 12, fontWeight: 500, opacity: disabled ? 0.7 : 1 }}>
              {busy ? "Uploading..." : `Upload ${items.length} image${items.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1.5px dashed var(--color-border-secondary)", borderRadius: 10, padding: "12px 14px", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: 12, background: "var(--color-background-primary)" }}>
            <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Choose images</span>
            <span style={{ fontSize: 11, opacity: 0.75 }}>PNG, JPG, WEBP</span>
            <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={onFilesChange} style={{ display: "none" }} aria-label="Choose image files" />
          </label>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{items.length}/{MAX_BULK_IMAGES} selected</div>
        </div>

        {notice && <div style={{ marginTop: 10, fontSize: 12, color: "#b45309" }}>{notice}</div>}
        {items.length === 0 ? (
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--color-text-secondary)" }}>No images selected yet.</div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            {items.map((item) => (
              <div key={item.id} style={{ border: "0.5px solid var(--color-border-secondary)", borderRadius: 10, padding: 8, background: "var(--color-background-primary)" }}>
                <div style={{ width: "100%", height: 96, borderRadius: 8, overflow: "hidden", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img src={item.previewUrl} alt={item.file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.file.name}>{item.file.name}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--color-text-secondary)" }}>
                    <span>{formatBytes(item.file.size)}</span>
                    <button data-ui-button="state" onClick={() => onRemove(item.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#dc2626", fontSize: 10, padding: 0 }}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminDisclosure>
  );
}
