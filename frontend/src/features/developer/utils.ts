export function formatDeveloperTimestamp(value: string | number): string {
    const date = typeof value === 'number' ? new Date(value) : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export function formatCompactNumber(value: number): string {
    return new Intl.NumberFormat(undefined, {
        notation: value >= 1000 ? 'compact' : 'standard',
        maximumFractionDigits: value >= 1000 ? 1 : 0,
    }).format(value);
}
