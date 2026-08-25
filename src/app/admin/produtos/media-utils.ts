export function mediaTypeFromMimeType(mimeType: string): 'IMAGE' | 'VIDEO' | 'PDF' | undefined {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    if (mimeType === 'application/pdf') return 'PDF';
    return undefined;
}
