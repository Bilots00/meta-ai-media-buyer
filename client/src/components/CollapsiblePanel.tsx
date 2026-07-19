import { useState, type ReactNode } from "react";
import { ChevronDown, ShoppingBag, Music2, Infinity as InfinityIcon, Radar } from "lucide-react";

export type Brand = "etsy" | "shopify" | "google" | "meta" | "tiktok" | "neutral";

const BRAND_COLOR: Record<Brand, string> = {
  etsy: "#F1641E",
  shopify: "#5E8E3E",
  google: "#1a73e8",
  meta: "#0866FF",
  tiktok: "#111827",
  neutral: "#2563eb",
};

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="15" height="15" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function BrandLogo({ brand }: { brand: Brand }) {
  const badge = (child: ReactNode) => (
    <span style={{ width: 26, height: 26, borderRadius: 8, background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }}>{child}</span>
  );
  if (brand === "google") return badge(<GoogleG />);
  if (brand === "shopify") return badge(<ShoppingBag size={15} color="#5E8E3E" strokeWidth={2.5} />);
  if (brand === "etsy") return badge(<span style={{ color: "#F1641E", fontWeight: 800, fontSize: 13, fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: -0.5 }}>Et</span>);
  if (brand === "meta") return badge(<InfinityIcon size={16} color="#0866FF" strokeWidth={2.5} />);
  if (brand === "tiktok") return badge(<Music2 size={15} color="#111" />);
  return badge(<Radar size={15} color="#2563eb" />);
}

export function CollapsiblePanel({
  brand, title, subtitle, right, defaultOpen, children,
}: {
  brand: Brand;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const color = BRAND_COLOR[brand];
  return (
    <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ background: color, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
        <button onClick={() => setOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, textAlign: "left", background: "transparent", border: 0, cursor: "pointer", minWidth: 0 }}>
          <BrandLogo brand={brand} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{title}</span>
            {subtitle && <span style={{ display: "block", color: "rgba(255,255,255,0.88)", fontSize: 11, marginTop: 1 }}>{subtitle}</span>}
          </span>
        </button>
        {right}
        <button onClick={() => setOpen((o) => !o)} style={{ background: "transparent", border: 0, cursor: "pointer", display: "flex" }} aria-label="toggle">
          <ChevronDown size={18} color="#fff" style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .15s" }} />
        </button>
      </div>
      {open && <div style={{ padding: 16 }}>{children}</div>}
    </div>
  );
}
