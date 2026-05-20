import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type KPITrend = 'up' | 'down' | 'flat' | null;

export interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  /** Variação vs. período anterior — texto curto, ex: "+12%" ou "−3 unidades" */
  delta?: string;
  /** Direção da tendência — define cor do delta */
  trend?: KPITrend;
  /** Ícone à direita do título */
  icon?: ReactNode;
  /** Texto explicativo no tooltip */
  tooltip?: string;
  /** Cor de destaque do valor (default: slate, alinhado ao Dashboard) */
  tone?: 'default' | 'green' | 'amber' | 'red' | 'slate';
  /** Click handler — se passado, vira card clicável */
  onClick?: () => void;
}

const toneClasses: Record<NonNullable<KPICardProps['tone']>, string> = {
  default: 'text-slate-500',
  green: 'text-farm-green-dark',
  amber: 'text-amber-700',
  red: 'text-red-700',
  slate: 'text-slate-500',
};

const trendIcons: Record<NonNullable<KPITrend>, ReactNode> = {
  up: <TrendingUp className="size-3.5" />,
  down: <TrendingDown className="size-3.5" />,
  flat: <Minus className="size-3.5" />,
};

const trendColors: Record<NonNullable<KPITrend>, string> = {
  up: 'text-emerald-600',
  down: 'text-red-600',
  flat: 'text-slate-400',
};

export function KPICard({ title, value, unit, delta, trend = null, icon, tooltip, tone = 'default', onClick }: KPICardProps) {
  const isClickable = !!onClick;
  return (
    <Card
      className={`border-slate-200 bg-white shadow-none ${isClickable ? 'cursor-pointer hover:border-farm-green/40 hover:shadow-md transition-all' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <CardTitle
            className="text-[15px] font-medium text-slate-700 truncate"
            style={{ fontFamily: "'Inter Tight', sans-serif" }}
          >
            {title}
          </CardTitle>
          {tooltip ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3 text-slate-400 shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        {icon ? <div className="text-slate-400 shrink-0">{icon}</div> : null}
      </CardHeader>
      <CardContent>
        <div className={`text-[16px] font-medium tabular-nums ${toneClasses[tone]}`}>
          {value}
          {unit ? <span className="ml-1 text-[14px] font-light text-slate-400">{unit}</span> : null}
        </div>
        {delta ? (
          <p className={`text-[14px] font-light mt-1 flex items-center gap-1 ${trend ? trendColors[trend] : 'text-slate-400'}`}>
            {trend ? trendIcons[trend] : null}
            <span>{delta}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
