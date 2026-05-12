'use client';

interface BillboardProps {
  image: string;
}

export default function Billboard({ image }: BillboardProps) {
  return (
    <div className="relative w-full max-w-[580px]" style={{ paddingBottom: '12px' }}>
      {/* Inner wrapper: float is visual only, outer div reserves space via paddingBottom */}
      <div
        className="w-full"
        style={{ animation: 'float 4s ease-in-out infinite', transformOrigin: 'center top' }}
      >
        {/* Screen */}
        <div className="w-full aspect-video rounded-t-md glow-border relative overflow-hidden border-2 border-[#c9a84c]/30">
          {/* Scanline */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[rgba(201,168,76,0.3)] to-transparent z-20"
            style={{ animation: 'scanline 3s linear infinite', top: 0 }}
          />
          {/* Image */}
          <img
            src={image}
            alt="Billboard advertisement"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Glow overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-10" />
        </div>
        {/* Pole */}
        <div className="w-[16px] h-16 bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-900 mx-auto" />
        {/* Base */}
        <div className="w-24 h-2 bg-gradient-to-r from-neutral-800 via-neutral-600 to-neutral-800 mx-auto rounded-sm" />
      </div>
    </div>
  );
}
