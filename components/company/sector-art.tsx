import { sceneFor, type SceneKind } from "@/lib/domain/company-shots";
import type { Company } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Last-resort picture when a company has no photo, homepage screenshot or
 * logo: an abstract illustration of its field (energy, health, money,
 * software...) in the company's colour, with its name. Drawn in code by AI,
 * so it is labelled "AI illustration" and never shows a real product, place
 * or person.
 */
export function SectorArt({ company, className, variant = "hero", showText = true }: { company: Pick<Company, "id" | "name" | "sector" | "subSector" | "artwork">; className?: string; variant?: "hero" | "card" | "thumb"; showText?: boolean }) {
  const hue = company.artwork.hue;
  const scene = sceneFor(company.sector, company.subSector);
  const id = `sa-${company.id}-${variant}`;
  const sky1 = `oklch(0.93 0.04 ${hue})`;
  const sky2 = `oklch(0.80 0.08 ${hue + 25})`;
  const ink = `oklch(0.34 0.09 ${hue})`;
  const mid = `oklch(0.55 0.12 ${hue})`;
  const soft = `oklch(0.70 0.10 ${hue + 15})`;
  const pale = `oklch(0.97 0.02 ${hue})`;
  const p = { ink, mid, soft, pale };
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)} role="img" aria-label={`AI illustration of ${company.name}'s field (${company.subSector ?? company.sector}); not a real picture of the company`}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={sky1} />
            <stop offset="1" stopColor={sky2} />
          </linearGradient>
        </defs>
        <rect width="640" height="400" fill={`url(#${id}-sky)`} />
        <Scene kind={scene} {...p} />
      </svg>
      {showText && variant !== "thumb" ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-5 pb-4 pt-12">
          <p className={cn("font-serif font-semibold leading-tight text-white", variant === "hero" ? "text-[1.75rem]" : "text-[1.25rem]")}>{company.name}</p>
          <p className="mt-0.5 text-[0.75rem] font-medium uppercase tracking-[0.12em] text-white/80">{company.subSector ?? company.sector}</p>
        </div>
      ) : null}
      {variant === "thumb" ? (
        <span className="absolute inset-0 flex items-center justify-center font-serif text-[1.125rem] font-semibold text-white drop-shadow-sm" aria-hidden>
          {company.name.slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[0.625rem] font-medium text-white/90">AI illustration</span>
      )}
    </div>
  );
}

type Palette = { ink: string; mid: string; soft: string; pale: string };

function Scene({ kind, ink, mid, soft, pale }: { kind: SceneKind } & Palette) {
  switch (kind) {
    case "climate":
      return (
        <g>
          <circle cx="500" cy="95" r="52" fill={pale} fillOpacity="0.9" />
          <path d="M0 300 C120 250 220 270 330 240 C450 205 540 235 640 215 V400 H0Z" fill={soft} />
          <path d="M0 340 C160 300 300 330 420 300 C520 278 580 290 640 280 V400 H0Z" fill={mid} />
          {[150, 260, 380].map((x, i) => (
            <g key={x} transform={`translate(${x} ${215 - i * 10})`}>
              <rect x="-3" y="0" width="6" height={110 + i * 10} fill={pale} />
              <g transform={`rotate(${20 + i * 25})`}>
                {[0, 120, 240].map((a) => (
                  <path key={a} transform={`rotate(${a})`} d="M0 0 C6 -14 6 -40 0 -58 C-6 -40 -6 -14 0 0Z" fill={pale} />
                ))}
              </g>
              <circle r="5" fill={ink} />
            </g>
          ))}
        </g>
      );
    case "health":
      return (
        <g>
          {[[160, 130, 70], [330, 210, 95], [500, 120, 60], [470, 290, 45]].map(([x, y, r], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={r} fill={i % 2 ? soft : pale} fillOpacity="0.75" />
              <circle cx={x + r * 0.2} cy={y - r * 0.15} r={r * 0.32} fill={mid} fillOpacity="0.55" />
            </g>
          ))}
          <path d="M0 250 H190 L215 205 L245 300 L275 170 L300 250 H640" stroke={ink} strokeWidth="5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </g>
      );
    case "money":
      return (
        <g>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={110 + i * 75} y={300 - (60 + i * 32)} width="48" height={60 + i * 32} rx="8" fill={i === 5 ? ink : i % 2 ? mid : soft} />
          ))}
          <path d="M100 250 C200 230 260 200 330 170 S470 110 560 70" stroke={pale} strokeWidth="6" fill="none" strokeLinecap="round" />
          <circle cx="560" cy="70" r="11" fill={pale} />
          <rect x="0" y="300" width="640" height="100" fill={pale} fillOpacity="0.5" />
        </g>
      );
    case "consumer":
      return (
        <g>
          <circle cx="320" cy="210" r="140" fill={pale} fillOpacity="0.8" />
          <path d="M210 120 C260 60 380 60 430 120 C490 190 440 300 320 320 C200 300 150 190 210 120Z" fill={soft} />
          <path d="M260 150 C300 110 360 120 380 170 C395 215 360 260 320 262 C270 262 235 200 260 150Z" fill={mid} />
          {[[120, 90], [520, 300], [540, 110], [110, 300]].map(([x, y], i) => (
            <path key={i} transform={`translate(${x} ${y}) rotate(${i * 50})`} d="M0 0 C18 -26 52 -26 70 0 C52 26 18 26 0 0Z" fill={i % 2 ? ink : mid} fillOpacity="0.7" />
          ))}
        </g>
      );
    case "build":
      return (
        <g>
          {[[200, 260], [300, 300], [400, 250], [300, 200], [500, 300]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path d="M0 0 L60 -34 L120 0 L60 34Z" fill={pale} />
              <path d="M0 0 L60 34 V110 L0 76Z" fill={i % 2 ? mid : soft} />
              <path d="M120 0 L60 34 V110 L120 76Z" fill={ink} />
            </g>
          ))}
          <circle cx="120" cy="100" r="34" fill="none" stroke={ink} strokeWidth="10" strokeDasharray="14 9" />
        </g>
      );
    case "farm":
      return (
        <g>
          <circle cx="510" cy="90" r="46" fill={pale} />
          <path d="M0 210 C200 180 440 180 640 200 V400 H0Z" fill={soft} />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <path key={i} d={`M${320 - 30 * i} 210 L${-200 + i * 40} 400`} stroke={mid} strokeWidth="9" opacity="0.8" />
          ))}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <path key={`r${i}`} d={`M${320 + 30 * i} 210 L${840 - i * 40} 400`} stroke={mid} strokeWidth="9" opacity="0.8" />
          ))}
          <g transform="translate(320 300)">
            <rect x="-4" y="-80" width="8" height="80" fill={ink} />
            <path d="M0 -60 C-40 -90 -70 -70 -70 -50 C-40 -40 -15 -45 0 -60Z" fill={ink} />
            <path d="M0 -75 C40 -110 72 -90 70 -68 C40 -58 15 -60 0 -75Z" fill={ink} />
          </g>
        </g>
      );
    case "move":
      return (
        <g>
          <path d="M-20 330 C140 330 160 210 320 210 S500 90 660 90" stroke={pale} strokeWidth="46" fill="none" />
          <path d="M-20 330 C140 330 160 210 320 210 S500 90 660 90" stroke={mid} strokeWidth="4" strokeDasharray="22 18" fill="none" />
          {[[120, 300], [320, 210], [520, 120]].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="18" fill={ink} />
              <circle cx={x} cy={y} r="7" fill={pale} />
            </g>
          ))}
          <path d="M0 400 L0 360 C200 340 420 380 640 350 V400Z" fill={soft} />
        </g>
      );
    default:
      return (
        <g>
          {[[120, 110], [250, 70], [380, 140], [520, 90], [170, 250], [330, 290], [470, 260], [580, 220]].map(([x, y], i, all) => (
            <g key={i}>
              {all.slice(i + 1, i + 3).map(([x2, y2], j) => (
                <line key={j} x1={x} y1={y} x2={x2} y2={y2} stroke={mid} strokeWidth="3" strokeOpacity="0.6" />
              ))}
            </g>
          ))}
          {[[120, 110], [250, 70], [380, 140], [520, 90], [170, 250], [330, 290], [470, 260], [580, 220]].map(([x, y], i) => (
            <circle key={`n${i}`} cx={x} cy={y} r={i % 3 === 0 ? 16 : 10} fill={i % 2 ? ink : pale} stroke={ink} strokeWidth="3" />
          ))}
        </g>
      );
  }
}
