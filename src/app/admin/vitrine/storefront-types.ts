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

export type BannerStatus = 'LIVE' | 'SCHEDULED' | 'ENDED' | 'INACTIVE';

export interface HomeBanner {
    id: string;
    label: string | null;
    title: string;
    body: string | null;
    ctaLabel: string;
    image: StorefrontImage | null;
    product: StorefrontProductRef;
    isActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
    isCurrent: boolean;
    status: BannerStatus;
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

export type StorefrontImageTarget = 'BANNER' | 'FEEDBACK' | 'CATEGORY';
