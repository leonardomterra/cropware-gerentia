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
                backgroundColor: '#fafafa',
                borderColor: '#e4e4e7',
            }}
        >
            {IconComponent && <IconComponent size={16} style={{ color: '#a1a1aa', flexShrink: 0 }} />}
            <p className="font-normal" style={{ fontSize: '14px', color: '#a1a1aa' }}>
                {title}
                {description && (
                    <span style={{ color: '#d4d4d8' }}> — {description}</span>
                )}
            </p>
        </div>
    );
}
