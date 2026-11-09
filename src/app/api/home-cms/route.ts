/* 首页首屏：片源站最新收录（不依赖豆瓣/TMDB，首屏先出内容） */

import { NextRequest, NextResponse} from 'next/server';

import { getAuthInfoFromCookie} from '@/lib/auth';
import { API_CONFIG, getAvailableApiSites} from '@/lib/config';
import { parseJsonLosslessIntegers} from '@/lib/json';
import { yellowWords} from '@/lib/yellow';

export const runtime = 'nodejs';

// 服务端进程内缓存 10 分钟：首页每次打开不重新拉 4 个源站
const CACHE_TTL_MS = 10 * 60 * 1000;
let cached: { expiresAt: number; results: unknown[]} | null = null;

interface CmsListItem {
vod_id: string | number;
vod_name: string;
vod_pic: string;
vod_year?: string;
vod_remarks?: string;
type_name?: string;
}

function normalizeTitle(title: string): string {
return title
.toLowerCase()
.replace(/[\s\-_·•\[\]()（）:：!！?？.,，]+/g, '');
}

export async function GET(request: NextRequest) {
const authInfo = getAuthInfoFromCookie(request);
if (!authInfo ||!authInfo.username) {
return NextResponse.json({ error: 'Unauthorized'}, { status: 401});
}

if (cached && cached.expiresAt > Date.now()) {
return NextResponse.json(
{ results: cached.results},
{
headers: {
'Cache-Control': 'public, max-age=600, s-maxage=600',
'CDN-Cache-Control': 'public, s-maxage=600',
'Vercel-CDN-Cache-Control': 'public, s-maxage=600',
'Netlify-Vary': 'query',
},
}
);
}

try {
const apiSites = await getAvailableApiSites(authInfo.username, false);
// 只取影视源：本站 AV 源的 key 以 av_ 开头，绝不上首页；
// 再加一道成人分类名过滤，双保险。
const movieSites = apiSites.filter(
(site) =>!site.key.toLowerCase().startsWith('av_')
);

const perSite = await Promise.all(
movieSites.slice(0, 4).map(async (site) => {
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 8000);
try {
// 不带分类参数的 videolist 返回各源站最新更新
const response = await fetch(`${site.api}?ac=videolist&pg=1`, {
headers: API_CONFIG.search.headers,
signal: controller.signal,
});
clearTimeout(timeoutId);
if (!response.ok) return [];
const data = parseJsonLosslessIntegers<{
list?: CmsListItem[];
}>(await response.text());
if (!data?.list ||!Array.isArray(data.list)) return [];
return data.list.slice(0, 10).map((item) => ({
id: item.vod_id.toString(),
title: (item.vod_name || '').trim(),
poster: item.vod_pic || '',
year: item.vod_year
? item.vod_year.match(/\d{4}/)?.[0] || ''
: '',
source: site.key,
source_name: site.name,
type_name: item.type_name || '',
vod_remarks: item.vod_remarks || '',
}));
} catch {
clearTimeout(timeoutId);
return [];
}
})
);

// 合并、过滤成人分类、按标题去重（同一部片多源只留一个）
const seen = new Set<string>();
const results: unknown[] = [];
for (const item of perSite.flat()) {
if (!item.title ||!item.poster) continue;
if (
yellowWords.some((word: string) =>
(item.type_name || '').includes(word)
)
) {
continue;
}
const key = normalizeTitle(item.title);
if (!key || seen.has(key)) continue;
seen.add(key);
results.push(item);
if (results.length >= 24) break;
}

cached = { expiresAt: Date.now() + CACHE_TTL_MS, results};

return NextResponse.json(
{ results},
{
headers: {
'Cache-Control': 'public, max-age=600, s-maxage=600',
'CDN-Cache-Control': 'public, s-maxage=600',
'Vercel-CDN-Cache-Control': 'public, s-maxage=600',
'Netlify-Vary': 'query',
},
}
);
} catch (error) {
console.error('[home-cms] 获取最新收录失败:', error);
return NextResponse.json({ results: []}, { status: 200});
}
}
