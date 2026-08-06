import type { CSSProperties, HTMLAttributes } from 'react';

type Props = HTMLAttributes<HTMLSpanElement> & {
  name: string;
  size?: number;
  weight?: number;
};

export function MaterialSymbol({ name, size = 22, weight = 400, style, className, ...props }: Props) {
  const iconStyle: CSSProperties = {
    fontSize: size,
    fontVariationSettings: `'FILL' 0, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${Math.min(48, Math.max(20, size))}`,
    ...style,
  };
  return (
    <span
      className={['material-symbols-sharp', className].filter(Boolean).join(' ')}
      aria-hidden="true"
      style={iconStyle}
      {...props}
    >
      {name}
    </span>
  );
}
