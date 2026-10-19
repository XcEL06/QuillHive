interface QuillHiveLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  variant?: 'default' | 'light' | 'dark';
}

export function QuillHiveLogo({
  size = 32,
  showWordmark = true,
  className = '',
  variant = 'default',
}: QuillHiveLogoProps) {
  const color =
    variant === 'light' ? '#ffffff' :
    variant === 'dark'  ? '#1a1a1a' :
    'hsl(var(--primary))';

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <img
        src="/images/logo-icon-192.png"
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        className="shrink-0 rounded-lg object-contain"
      />

      {showWordmark && (
        <span
          className="font-bold tracking-tight"
          style={{
            fontSize: size * 0.55,
            color,
            fontFamily: "'Inter', system-ui, sans-serif",
            letterSpacing: '-0.02em',
          }}
        >
          Quill<span style={{ opacity: 0.7 }}>Hive</span>
        </span>
      )}
    </div>
  );
}
