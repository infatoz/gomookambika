import React from 'react';

export interface AppLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  variant?: 'full' | 'mark' | 'horizontal';
  theme?: 'dark' | 'light';
  subtitle?: string;
  className?: string;
  useImage?: boolean;
}

export function AppLogo({
  size = 'md',
  variant = 'horizontal',
  theme = 'light',
  subtitle,
  className = '',
  useImage = false,
}: AppLogoProps) {
  const pixelSize =
    typeof size === 'number'
      ? size
      : { xs: 26, sm: 32, md: 40, lg: 52, xl: 64 }[size];

  const isLight = theme === 'light';

  if (useImage || variant === 'full') {
    return (
      <img
        src="/logo.png"
        alt="Go Mookambika"
        className={`object-contain select-none ${className}`}
        style={{ height: pixelSize, width: 'auto' }}
      />
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Icon Mark Emblem */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-2xl overflow-hidden shadow-xs transition-transform active:scale-95 bg-transparent"
        style={{
          width: pixelSize,
          height: pixelSize,
        }}
      >
        <img
          src="/app-icon.png"
          alt="Go Mookambika"
          className="w-full h-full object-contain filter drop-shadow-xs"
        />
      </div>

      {/* Typography Wordmark */}
      {variant !== 'mark' && (
        <div className="flex flex-col text-left leading-tight">
          <div className="flex items-center gap-1 font-black tracking-tight" style={{ fontSize: Math.max(15, pixelSize * 0.44) }}>
            <span className="text-amber-500">Go</span>
            <span className={isLight ? 'text-black' : 'text-white'}>Mookambika</span>
          </div>
          {subtitle && (
            <span
              className={`font-semibold tracking-wider uppercase text-[10px] ${
                isLight ? 'text-neutral-500' : 'text-neutral-400'
              }`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default AppLogo;
