export const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN || '';
export const FB_PAGE_ID = process.env.FB_PAGE_ID || '';
export const KIE_API_KEY = process.env.KIE_API_KEY || '';

export function getFacebookConfig() {
  return {
    accessToken: FB_ACCESS_TOKEN,
    pageId: FB_PAGE_ID,
    apiVersion: 'v21.0',
  };
}
