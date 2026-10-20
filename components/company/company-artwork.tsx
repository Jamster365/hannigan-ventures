import type { Company, CompanyMedia } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Hero/card imagery.
 *
 * If licensed media exists (rightsStatus permitted/attributed, url set) it is
 * rendered. Otherwise we draw the "premium typographic fallback": a designed
 * editorial gradient with an abstract motif and the company wordmark, carrying
 * the company's real logo when we have one. This is never a photorealistic
 * image and never pretends to show a real product.
 */
export function CompanyArtwork({ company, media, logo = null, className, variant = "card", priority: _priority }: { company: Company; media: CompanyMedia | null; logo?: CompanyMedia | null; className?: string; variant?: "card" | "hero" | "thumb"; priority?: boolean }) {
  if (media?.url && media.rightsStatus !== "fallback") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={media.url} alt={media.altText} className={cn("h-full w-full object-cover", className)} loading={variant === "hero" ? "eager" : "lazy"} />
    );
  }
  const { hue, motif } = company.artwork;
  const c1 = `oklch(0.32 0.07 ${hue})`;
  const c2 = `oklch(0.22 0.06 ${hue + 30})`;
  const c3 = `oklch(0.72 0.12 ${hue + 10})`;
  const id = `art-${company.id}-${variant}`;
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)} role="img" aria-label={media?.altText ?? `${company.name} artwork`}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c1} />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
          <radialGradient id={`${id}-r`} cx="0.8" cy="0.2" r="0.8">
            <stop offset="0" stopColor={c3} stopOpacity="0.55" />
            <stop offset="1" stopColor={c3} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="260" fill={`url(#${id}-g)`} />
        <rect width="400" height="260" fill={`url(#${id}-r)`} />
        <Motif motif={motif} color={c3} />
      </svg>
      {logo?.url ? <LogoTile logo={logo} variant={variant} /> : null}
      {variant === "thumb" && logo?.url ? null : variant === "card" ? (
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="font-serif text-[22px] font-semibold leading-none text-white/95 drop-shadow-sm">{company.name}</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/70">{company.subSector ?? company.sector}</p>
        </div>
      ) : variant === "thumb" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-serif text-[20px] font-semibold text-white/95">{company.name.slice(0, 1)}</span>
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/70">{company.subSector ?? company.sector}</p>
        </div>
      )}
    </div>
  );
}

function LogoTile({ logo, variant }: { logo: CompanyMedia; variant: "card" | "hero" | "thumb" }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo.url!} alt={logo.altText} className="h-full w-full object-contain" loading={variant === "hero" ? "eager" : "lazy"} />
  );
  if (variant === "thumb") return <div className="absolute inset-0 flex items-center justify-center bg-white p-1.5">{img}</div>;
  return <div className={cn("absolute left-4 rounded-[14px] bg-white p-2 shadow-sm", variant === "hero" ? "top-1/2 size-[72px] -translate-y-1/2 sm:size-[88px]" : "top-4 size-14")}>{img}</div>;
}

function Motif({ motif, color }: { motif: Company["artwork"]["motif"]; color: string }) {
  const stroke = { stroke: color, strokeOpacity: 0.35, fill: "none", strokeWidth: 1.2 } as const;
  switch (motif) {
    case "orbit":
      return (
        <g {...stroke}>
          <ellipse cx="290" cy="90" rx="120" ry="48" transform="rotate(-18 290 90)" />
          <ellipse cx="290" cy="90" rx="80" ry="30" transform="rotate(-18 290 90)" />
          <circle cx="290" cy="90" r="10" fill={color} fillOpacity="0.5" stroke="none" />
          <circle cx="395" cy="55" r="4" fill={color} fillOpacity="0.7" stroke="none" />
        </g>
      );
    case "grid":
      return (
        <g {...stroke} strokeOpacity={0.22}>
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`v${i}`} x1={220 + i * 24} y1="0" x2={220 + i * 24} y2="260" />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={`h${i}`} x1="200" y1={20 + i * 24} x2="400" y2={20 + i * 24} />
          ))}
          <rect x="268" y="68" width="48" height="48" fill={color} fillOpacity="0.45" stroke="none" />
        </g>
      );
    case "wave":
      return (
        <g {...stroke}>
          {Array.from({ length: 6 }).map((_, i) => (
            <path key={i} d={`M0 ${60 + i * 26} C 100 ${30 + i * 26}, 200 ${90 + i * 26}, 400 ${50 + i * 26}`} />
          ))}
        </g>
      );
    case "facet":
      return (
        <g {...stroke}>
          <polygon points="300,30 380,80 360,170 270,190 220,110" fill={color} fillOpacity="0.18" />
          <polygon points="300,30 360,170 220,110" />
          <polygon points="380,80 270,190 300,30" />
        </g>
      );
    case "ring":
      return (
        <g {...stroke}>
          {[20, 44, 68, 92, 116].map((r) => (
            <circle key={r} cx="330" cy="70" r={r} />
          ))}
        </g>
      );
    default:
      return (
        <g fill={color} fillOpacity="0.4">
          {Array.from({ length: 48 }).map((_, i) => (
            <circle key={i} cx={210 + (i % 8) * 26} cy={30 + Math.floor(i / 8) * 34} r={1.5 + ((i * 7) % 4) * 0.8} />
          ))}
        </g>
      );
  }
}
