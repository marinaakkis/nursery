/** Искра — знак искусственного интеллекта в продукте: четыре луча, один
 *  цвет. Лист остаётся знаком бренда, искра — знаком помощника. */
export function SparkMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0.5c.5 3.6 3.4 6.5 7 7-3.6.5-6.5 3.4-7 7-.5-3.6-3.4-6.5-7-7 3.6-.5 6.5-3.4 7-7Z" />
    </svg>
  );
}
