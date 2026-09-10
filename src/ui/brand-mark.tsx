/** Знак бренда: лист. Инлайновый SVG — эмодзи вместо иконок запрещены,
 *  а внешние картинки в сборку контейнера тянуть незачем. */
export function BrandMark({ size = 24, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d="M12 21c0-6.5 3-10.5 7.5-12.5C19.5 15 16 20 12 21Z" />
      <path d="M12 21C8 20 4.5 15 4.5 8.5 9 10.5 12 14.5 12 21Z" />
      <path d="M12 21v-4" />
    </svg>
  );
}
