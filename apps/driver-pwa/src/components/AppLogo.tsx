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
  theme = 'dark',
  subtitle,
  className = '',
  useImage = false,
}: AppLogoProps) {
  const pixelSize =
    typeof size === 'number'
      ? size
      : { xs: 26, sm: 32, md: 40, lg: 52, xl: 64 }[size];

  const isLight = theme === 'light';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Icon Mark Emblem */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-xl overflow-hidden shadow-sm transition-transform active:scale-95"
        style={{
          width: pixelSize,
          height: pixelSize,
          background: 'linear-gradient(145deg, #0f172a, #020617)',
          border: '1px solid rgba(245, 158, 11, 0.45)',
          boxShadow: '0 2px 10px rgba(245, 158, 11, 0.25)',
        }}
      >
        {useImage ? (
          <img
            src="/logo-icon.jpg"
            alt="Go Mookambika Logo"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <svg
            viewBox="0 0 120 120"
            className="w-full h-full p-1"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="gmGoldGradDriver" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE68A" />
                <stop offset="35%" stopColor="#F59E0B" />
                <stop offset="70%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
            </defs>

            {/* Halo Glow */}
            <circle cx="60" cy="46" r="28" fill="#F59E0B" fillOpacity="0.08" />

            {/* Top Kalasha Finial */}
            <path d="M60 14 C62 17, 63 20, 60 23 C57 20, 58 17, 60 14 Z" fill="url(#gmGoldGradDriver)" />
            <circle cx="60" cy="24" r="2.2" fill="#FDE68A" />

            {/* Tier 1 */}
            <path d="M53 27 L67 27 L65 33 L55 33 Z" stroke="url(#gmGoldGradDriver)" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M51 32 C54 28, 56 32, 60 29 C64 32, 66 28, 69 32" stroke="url(#gmGoldGradDriver)" strokeWidth="1.6" />

            {/* Tier 2 */}
            <path d="M49 35 L71 35 L73 44 L47 44 Z" stroke="url(#gmGoldGradDriver)" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M57 44 L57 39 C57 37.5, 63 37.5, 63 39 L63 44" stroke="url(#gmGoldGradDriver)" strokeWidth="1.8" />

            {/* Tier 3 */}
            <path d="M44 46 L76 46 L79 57 L41 57 Z" stroke="url(#gmGoldGradDriver)" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M55 57 L55 50 C55 48.5, 65 48.5, 65 50 L65 57" stroke="url(#gmGoldGradDriver)" strokeWidth="1.8" />
            <path d="M48 57 L48 52 C48 51, 51 51, 51 52 L51 57" stroke="url(#gmGoldGradDriver)" strokeWidth="1.4" />
            <path d="M72 57 L72 52 C72 51, 69 51, 69 52 L69 57" stroke="url(#gmGoldGradDriver)" strokeWidth="1.4" />

            {/* Sanctum Gateway */}
            <path d="M53 70 L53 60 C53 56, 67 56, 67 60 L67 70" stroke="url(#gmGoldGradDriver)" strokeWidth="2.4" />

            {/* Winding Highway Lines */}
            <path d="M40 59 C44 72, 32 86, 18 104" stroke="url(#gmGoldGradDriver)" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M80 59 C78 74, 92 88, 102 104" stroke="url(#gmGoldGradDriver)" strokeWidth="3.2" strokeLinecap="round" />

            {/* Road Dividing Center Dashes */}
            <path d="M60 63 L60 68" stroke="#FDE68A" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M60 73 L60 81" stroke="#FDE68A" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M60 86 L60 97" stroke="#FDE68A" strokeWidth="3" strokeLinecap="round" />
            <path d="M60 102 L60 106" stroke="#FDE68A" strokeWidth="3.2" strokeLinecap="round" />
          </svg>
        )}
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
