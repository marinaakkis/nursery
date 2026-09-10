/** Знак бренда: ветка с листьями. Инлайновый SVG в один цвет — эмодзи вместо
 *  иконок запрещены правилами визуала, градиентов в знаке нет. */
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
      <path d="M12 22V9" />
      <path d="M12 13c0-3.3 2.4-5.6 6-6-.3 3.6-2.4 6-6 6Z" />
      <path d="M12 17c-3.3 0-5.6-2-6-5 3.6.3 6 2 6 5Z" />
      <path d="M12 9c-1.9 0-3.3-1.6-3.3-3.7C10.6 5.6 12 7 12 9Z" />
    </svg>
  );
}
