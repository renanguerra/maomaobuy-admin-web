/** Respostas do painel da vitrine (`/home/*` no app admin). */

export interface StorefrontImage {
    key: string;
    url: string | null;
    alt: string;
}

export interface StorefrontProductRef {
    id: string;
    name: string;
    slug: string;
    isPublished: boolean;
    inStock: boolean;
    imageUrl: string | null;
}

export type FeedbackStatus = 'LIVE' | 'AWAITING_AUTHORIZATION' | 'HIDDEN';

export interface FeedbackPost {
    id: string;
    image: StorefrontImage;
    instagramHandle: string;
    postUrl: string;
    product: StorefrontProductRef | null;
    authorizedAt: string | null;
    authorizationNote: string | null;
    isVisible: boolean;
    status: FeedbackStatus;
}

export interface CategoryShortcut {
    id: string;
    name: string;
    slug: string;
    image: StorefrontImage | null;
    productCount: number;
}

export type StorefrontImageTarget = 'FEEDBACK' | 'CATEGORY';
