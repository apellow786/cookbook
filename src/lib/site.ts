import content from '../data/site-content.json';

export const siteContent = content;
export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (path = '/') => `${base}${path.startsWith('/') ? path : `/${path}`}`;
export const recipeUrl = (slug: string) => url(`/recipes/${slug}/`);
export const categoryUrl = (slug: string) => url(`/category/${slug}/`);
export const tipUrl = (slug: string) => url(`/tips/${slug}/`);
