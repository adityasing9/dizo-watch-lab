import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent' | 'purple' | 'yellow';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-950/70 text-emerald-400 border-emerald-800/60',
  warning: 'bg-amber-950/70 text-amber-400 border-amber-800/60',
  danger: 'bg-rose-950/70 text-rose-400 border-rose-800/60',
  info: 'bg-blue-950/70 text-blue-400 border-blue-800/60',
  neutral: 'bg-slate-900/80 text-slate-400 border-slate-700/60',
  accent: 'bg-yellow-950/80 text-yellow-400 border-yellow-800/70',
  yellow: 'bg-yellow-950/80 text-yellow-400 border-yellow-800/70',
  purple: 'bg-purple-950/70 text-purple-400 border-purple-800/60',
};

const dotStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400 animate-pulse',
  danger: 'bg-rose-400',
  info: 'bg-blue-400',
  neutral: 'bg-slate-400',
  accent: 'bg-yellow-400 animate-pulse',
  yellow: 'bg-yellow-400',
  purple: 'bg-purple-400',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '', dot = false }) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-medium border ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[variant]}`} />}
      {children}
    </span>
  );
};
