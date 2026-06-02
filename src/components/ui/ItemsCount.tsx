import React from 'react';
import { X } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';

interface ItemsCountProps {
    count: number;
    itemLabel: React.ReactNode;
    itemLabelPlural: React.ReactNode;
    totalCount?: number;
    showClearFilters?: boolean;
    onClearFilters?: () => void;
    className?: string;
    headerSuffix?: React.ReactNode;
}

export function ItemsCount({
    count,
    itemLabel,
    itemLabelPlural,
    totalCount,
    showClearFilters,
    onClearFilters,
    className,
    headerSuffix
}: ItemsCountProps) {
    const label = count === 1 ? itemLabel : itemLabelPlural;

    return (
        <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 px-1 my-2", className)}>
            <div className="truncate min-w-0 font-normal" style={{ fontSize: '14px', color: '#a1a1aa' }}>
                Mostrando {count} {totalCount !== undefined && totalCount !== count ? `de ${totalCount} ` : ''}{label}
                {headerSuffix && (
                    <span className="ml-1" style={{ color: '#27272a' }}>
                        {headerSuffix}
                    </span>
                )}
            </div>

            {showClearFilters && onClearFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearFilters}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 font-normal h-8 px-2"
                    title="Limpar filtros"
                >
                    <X className="size-4 mr-1.5" />
                    Limpar Filtros
                </Button>
            )}
        </div>
    );
}
