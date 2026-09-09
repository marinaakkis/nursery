/** Иконки требований. Инлайновый SVG, а не эмодзи: эмодзи вместо иконок запрещены
 *  правилами визуала. Все декоративные — подпись рядом несёт смысл сама. */
const common = {
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function SunIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M16 4l-1.4 1.4M5.4 14.6 4 16" />
    </svg>
  );
}

export function ZoneIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M10 2v16M3 6l14 8M17 6 3 14" />
      <path d="M10 5.5 8 3.5M10 5.5l2-2M10 14.5l-2 2M10 14.5l2 2" />
    </svg>
  );
}

export function DropIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M10 2.5s5 5.6 5 8.8a5 5 0 0 1-10 0c0-3.2 5-8.8 5-8.8Z" />
    </svg>
  );
}

export function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <rect x="2.5" y="4" width="15" height="13.5" rx="2" />
      <path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3" />
    </svg>
  );
}

export function SoilIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <path d="M2.5 12h15M2.5 16h15M5 12V8a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
