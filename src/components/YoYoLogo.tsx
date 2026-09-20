import React from 'react';

interface YoYoLogoProps {
  className?: string;
  iconOnly?: boolean;
}

export default function YoYoLogo({ className = '', iconOnly = false }: YoYoLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Dynamic Rounded Logo Avatar Frame */}
      <div className="relative flex items-center justify-center w-11 h-11 shrink-0">
        <div className="absolute inset-0 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-xl rotate-6 opacity-20 animate-pulse"></div>
        <img 
          src="/logo.jpg" 
          alt="ZOYO Logo" 
          referrerPolicy="no-referrer"
          className="w-10 h-10 rounded-xl object-cover shadow-md border border-zinc-200/60 z-10 hover:scale-105 transition-transform"
        />
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white animate-ping z-25"></div>
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white z-25"></div>
      </div>

      {!iconOnly && (
        <div className="flex flex-col leading-none text-left">
          <span className="font-display text-xl font-black tracking-wider bg-gradient-to-r from-indigo-600 via-rose-500 to-amber-500 bg-clip-text text-transparent">
            ZOYO
          </span>
          <span className="text-[7.5px] font-display font-extrabold tracking-widest text-zinc-400 uppercase mt-0.5">
            PLAY • CONNECT • HAVE FUN
          </span>
        </div>
      )}
    </div>
  );
}
