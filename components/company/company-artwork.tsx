import type { Company, CompanyMedia } from "@/lib/domain/types";
import { homepageShot } from "@/lib/domain/company-shots";
import { cn } from "@/lib/utils";
import { SectorArt } from "./sector-art";

/**
 * Hero/card imagery, best first: the company's own photo (rights recorded),
 * a screenshot of its own homepage, its logo on its colour, and last an AI
 * illustration of its field, labelled as such. Nothing here ever pretends to
 * show a real product, place or person that it isn't.
 */
export function CompanyArtwork({ company, media, logo = null, className, variant = "card", showText = true, priority: _priority }: { company: Company; media: CompanyMedia | null; logo?: CompanyMedia | null; className?: string; variant?: "card" | "hero" | "thumb"; showText?: boolean; priority?: boolean }) {
  if (media?.url && media.rightsStatus !== "fallback") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={media.url} alt={media.altText} className={cn("h-full w-full object-cover", className)} loading={variant === "hero" ? "eager" : "lazy"} />
    );
  }
  // No photo of their own: a screenshot of their homepage, then their logo on
  // their colour, then an AI illustration of their field (labelled as such).
  const shot = homepageShot(company);
  if (shot) {
    return (
      <div className={cn("relative h-full w-full overflow-hidden bg-surface-muted", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.url} alt={`${company.name} homepage (screenshot)`} className="h-full w-full object-cover object-top" loading={variant === "hero" ? "eager" : "lazy"} />
        {variant !== "thumb" ? <span className="absolute right-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[0.625rem] font-medium text-white/90">Their homepage</span> : null}
      </div>
    );
  }
  if (logo?.url) {
    return (
      <div className={cn("relative flex h-full w-full items-center justify-center overflow-hidden", className)} style={{ background: `oklch(0.95 0.025 ${company.artwork.hue})` }} role="img" aria-label={logo.altText}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo.url} alt="" className={variant === "thumb" ? "max-h-[70%] max-w-[70%] object-contain" : "max-h-[42%] max-w-[60%] object-contain"} loading={variant === "hero" ? "eager" : "lazy"} />
        {variant !== "thumb" ? <span className="absolute right-2 top-2 rounded-full bg-black/30 px-2 py-0.5 text-[0.625rem] font-medium text-white/90">Logo</span> : null}
        {variant === "card" ? <span className="absolute inset-x-0 bottom-0 px-4 pb-3 font-serif text-[1.25rem] font-semibold text-ink/80">{company.name}</span> : null}
      </div>
    );
  }
  return <SectorArt company={company} className={className} variant={variant} showText={showText} />;
}
