interface EmptyStateCardProps {
    title: string;
    description?: string;
    icon?: any;
    fullHeight?: boolean;
    /** Viewport offset in px for fullHeight calc. Default 280. Increase for pages with extra toolbars/filters. */
    minHeightOffset?: number;
}

export function EmptyStateCard({
    title,
    description,
    icon: IconComponent,
}: EmptyStateCardProps) {
    return (
        <div
            className="w-full rounded-lg border py-4 px-5 flex items-center justify-center gap-2"
            style={{
                backgroundColor: '#f8fafc',
                borderColor: '#e2e8f0',
            }}
        >
            {IconComponent && <IconComponent size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />}
            <p className="font-normal" style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: '14px', color: '#94a3b8' }}>
                {title}
                {description && (
                    <span style={{ color: '#cbd5e1' }}> — {description}</span>
                )}
            </p>
        </div>
    );
}
