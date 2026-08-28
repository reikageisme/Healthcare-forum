import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  subtext?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'indigo';
  onClick?: () => void;
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-100',
    iconBg: 'bg-blue-500 text-white',
  },
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-100',
    iconBg: 'bg-emerald-500 text-white',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-100',
    iconBg: 'bg-amber-500 text-white',
  },
  rose: {
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    border: 'border-rose-100',
    iconBg: 'bg-rose-500 text-white',
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-100',
    iconBg: 'bg-purple-500 text-white',
  },
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
    border: 'border-indigo-100',
    iconBg: 'bg-indigo-500 text-white',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  subtext,
  trend,
  color = 'blue',
  onClick,
}) => {
  const c = colorMap[color] || colorMap.blue;

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl p-5 border border-border shadow-xs flex flex-col justify-between transition-all',
        onClick && 'cursor-pointer hover:border-primary hover:shadow-md'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shadow-xs', c.iconBg)}>
          <Icon size={20} />
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
          </span>
          {trend && (
            <span
              className={cn(
                'text-xs font-bold px-1.5 py-0.5 rounded',
                trend.isPositive !== false
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              )}
            >
              {trend.value}
            </span>
          )}
        </div>

        {subtext && (
          <p className="text-xs text-slate-500 mt-1 font-medium">{subtext}</p>
        )}
      </div>
    </div>
  );
};

export default StatCard;
