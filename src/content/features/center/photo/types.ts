/** Типы ответов VK photos API. */

export interface PhotoSize { url: string; width: number; height: number; type: string }
export interface PhotoItem { id: number; owner_id: number; sizes: PhotoSize[] }
export interface PhotosGetResponse { count: number; items: PhotoItem[] }
