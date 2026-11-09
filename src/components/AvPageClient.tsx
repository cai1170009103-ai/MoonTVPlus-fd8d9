'use client';

import { Flame, Loader2, Search} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState} from 'react';

import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

// 已配置的 AV 源 key（与数据库 admin_config 的 api_site 一致）
const AV_SOURCE_KEYS = new Set([
'av_lb',
'av_shayu',
'av_senlin',
'av_fh',
'av_lajiao',
'av_155',
]);

// 兜底：按源站显示名识别 AV 源
const AV_SOURCE_NAMES = [
'乐播资源',
'鲨鱼资源',
'森林资源',
'番号资源',
'辣椒资源',
'155资源',
];

// 置顶女优：固定排在最前面，顺序不变（用户指定）
const PINNED_ACTRESSES = [
'鷲尾芽衣',
'佐山爱',
'三上悠亜',
'奥田咲',
'城崎百濑',
'桜空もも',
'雏之花音',
'北岛玲',
'乙爱丽丝',
];

// 置顶女优的搜索用名：显示名与片源数据里的名字不一致时用映射
// 桜空もも = 樱空桃（同一人，日文名 / 中文译名），中文片源里用樱空桃才能搜到
const SEARCH_NAME_MAP: Record<string, string> = {
'桜空もも': '樱空桃',
};
function searchNameFor(displayName: string): string {
return SEARCH_NAME_MAP[displayName] ?? displayName;
}

// 热门女优（点一下即按名字搜索 AV 源）；置顶 9 位之后按作品数重新排序
const ACTRESSES = [
'河北彩花',
'深田咏美',
'明日花绮罗',
'桥本有菜',
'波多野结衣',
'松本一香',
'石川澪',
'高桥圣子',
'水卜樱',
'桃乃木香奈',
'相泽南',
'山岸逢花',
'神宫寺奈绪',
'枫花恋',
'伊藤舞雪',
'美谷朱里',
'白桃花',
'苍井空',
];

const DEFAULT_ACTRESS = '三上悠亜';
const PAGE_SIZE = 30;
// 女优作品数统计的并发数：避免 20 个名字同时打爆服务端搜索
const RANK_CONCURRENCY = 4;

interface AvResult {
id: string;
source: string;
source_name: string;
title: string;
poster: string;
year?: string;
type_name?: string;
episodes?: unknown[];
vod_remarks?: string;
/** 携带该片的源站 key 列表（去重后合并） */
sources?: string[];
}

function isAvResult(item: AvResult): boolean {
if (AV_SOURCE_KEYS.has(item.source)) {
return true;
}
return AV_SOURCE_NAMES.some((name) => item.source_name === name);
}

/* ---------------- 跨源去重 ---------------- */

// 从标题里提取番号，如 SONE-593 / SONE593 / IPZZ-123，统一成 SONE593
function extractCode(title: string): string {
const match = title.match(/([A-Za-z]{2,6})[-_]?(\d{3,5})/);
if (!match) {
return '';
}
return `${match[1].toUpperCase()}${match[2]}`;
}

// 标题归一化：去括号内容、去常见标签、去空白标点、全角转半角、转小写
function normalizeTitle(title: string): string {
let s = title
.replace(/]*】/g, '')
.replace(/\[[^\]]*\]/g, '')
.replace(/\([^)]*\)/g, '')
.replace(/（[^）]*）/g, '')
.replace(/《[^》]*》/g, '');
s = s
.replace(/中文字幕|无码|有码|高清|蓝光|完整版|未删减|国语|粤语|4K|1080P|720P/g, '')
.replace(/[\s\p{P}\p{S}]/gu, '');
// 全角转半角
s = s.replace(/[\uFF01-\uFF5E]/g, (ch) =>
String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
);
return s.toLowerCase();
}

// 从 vod_remarks 里解析时长（分钟），如 "91分20秒" / "2小时10分"
function parseDurationMinutes(remarks?: string): number {
if (!remarks) {
return 0;
}
const hourMatch = remarks.match(/(\d+)\s*小时(?:\s*(\d+)\s*分)?/);
if (hourMatch) {
return (
parseInt(hourMatch[1], 10) * 60 + (hourMatch[2]? parseInt(hourMatch[2], 10): 0)
);
}
const minMatch = remarks.match(/(\d+)\s*分(?:\s*(\d+)\s*秒)?/);
if (minMatch) {
return (
parseInt(minMatch[1], 10) +
(minMatch[2]? parseInt(minMatch[2], 10) / 60: 0)
);
}
return 0;
}

// 同一部片保留信息最全的那条：时长最长 > 集数最多 > 有海报 > 标题更长
function scoreItem(item: AvResult): number {
const episodes = Array.isArray(item.episodes)? item.episodes.length: 0;
return (
parseDurationMinutes(item.vod_remarks) * 10 +
episodes * 5 +
(item.poster? 2: 0) +
Math.min(item.title.length, 40) * 0.1
);
}

// 跨源去重：同一番号或同一归一化标题只留一条，并合并 sources
function dedupeResults(list: AvResult[]): AvResult[] {
const byKey = new Map<string, AvResult>();
const titleToKey = new Map<string, string>();

for (const item of list) {
if (!item.id ||!item.source) {
continue;
}
const code = extractCode(item.title);
const normalized = normalizeTitle(item.title);
// 主 key：有番号用番号，否则用归一化标题
let key = code? `code:${code}`: `title:${normalized}`;
// 没有番号的条目，如果归一化标题撞上已有番号条目，归到那一条
if (!code && normalized && titleToKey.has(normalized)) {
key = titleToKey.get(normalized)!;
}
const existing = byKey.get(key);
if (!existing) {
byKey.set(key, {...item, sources: [item.source]});
if (normalized) {
titleToKey.set(normalized, key);
}
continue;
}
// 合并来源
const sources = existing.sources || [existing.source];
if (!sources.includes(item.source)) {
sources.push(item.source);
}
// 信息更全的条目胜出（保留其 id/source 用于播放）
if (scoreItem(item) > scoreItem(existing)) {
byKey.set(key, {...item, sources});
} else {
existing.sources = sources;
}
}

return Array.from(byKey.values());
}

// 女优头像：维基共享资源公开活动照缩略图（250px，可直接外链）；
// 找不到合适公开照片的女优不在此表里，页面会用首字圆圈兜底。
const ACTRESS_AVATARS: Record<string, string> = {
'三上悠亜': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Mikami_Yua_to_K-POP_CIMG6925_%28cropped%29.jpg/250px-Mikami_Yua_to_K-POP_CIMG6925_%28cropped%29.jpg',
'奥田咲': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Fresh_Summer_Fes%21%21_Gold_Division_IMG_9688.jpg/250px-Fresh_Summer_Fes%21%21_Gold_Division_IMG_9688.jpg',
'桜空もも': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/Tregal_Academy_Cultural_Festival_2026IMG_5386.jpg/250px-Tregal_Academy_Cultural_Festival_2026IMG_5386.jpg',
'乙爱丽丝': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/Fresh_Festival_2023_in_Shirakobato_Water_Park_IMG_2984.jpg/250px-Fresh_Festival_2023_in_Shirakobato_Water_Park_IMG_2984.jpg',
'河北彩花': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Trend_Girls_Photo_Session_%28September_28%2C_2025%29_IMG_3232.jpg/250px-Trend_Girls_Photo_Session_%28September_28%2C_2025%29_IMG_3232.jpg',
'深田咏美': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/20230804_Eimi_Fukada_%28%E6%B7%B1%E7%94%B0%E3%81%88%E3%81%84%E3%81%BF%29.jpg/250px-20230804_Eimi_Fukada_%28%E6%B7%B1%E7%94%B0%E3%81%88%E3%81%84%E3%81%BF%29.jpg',
'明日花绮罗': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/%EC%95%84%EC%8A%A4%EC%B9%B4_%ED%82%A4%EB%9D%BC%EB%9D%BC%28Kirara_Asuka%29_%ED%8C%AC%EB%AF%B8%ED%8C%85_%289%29.jpg/250px-%EC%95%84%EC%8A%A4%EC%B9%B4_%ED%82%A4%EB%9D%BC%EB%9D%BC%28Kirara_Asuka%29_%ED%8C%AC%EB%AF%B8%ED%8C%85_%289%29.jpg',
'桥本有菜': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/%E6%A9%8B%E6%9C%AC%E3%81%82%E3%82%8A%E3%81%AA.jpg/250px-%E6%A9%8B%E6%9C%AC%E3%81%82%E3%82%8A%E3%81%AA.jpg',
'波多野结衣': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/%ED%95%98%ED%83%80%EB%85%B8%EC%9C%A0%EC%9D%B4%28Yui_Hatano%29_%EC%9A%A9%EA%B3%BC%EA%B0%99%EC%9D%B4_%EA%B8%B0%E5%BF%B5%ED%96%89%E4%BA%8B_4.jpg/250px-%ED%95%98%ED%83%80%EB%85%B8%EC%9C%A0%EC%9D%B4%28Yui_Hatano%29_%EC%9A%A9%EA%B3%BC%EA%B0%99%EC%9D%B4_%E5%BF%B5%ED%96%89%E4%BA%8B_4.jpg',
'松本一香': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/IchikaMatsumoto24HourLiveStream_~I_can%27t_go_home_unless_I_sell_1000_bottles~_Akihabara_LamTarra_Apikari_IMG_6237ichka.jpg/250px-IchikaMatsumoto24HourLiveStream_~I_can%27t_go_home_unless_I_sell_1000_bottles~_Akihabara_LamTarra_Apikari_IMG_6237ichka.jpg',
'石川澪': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/January_24%2C_2026_%22Modern_Mahjong_Academy%22_in_Kawachi_Town%2C_Ibaraki_Prefecture_IMG_3037.jpg/250px-January_24%2C_2026_%22Modern_Mahjong_Academy%22_in_Kawachi_Town%2C_Ibaraki_Prefecture_IMG_3037.jpg',
'高桥圣子': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/%E9%AB%98%E6%A9%8B%E3%81%97%E3%82%87%E3%81%86%E5%AD%902018%E5%B9%B4.jpg/250px-%E9%AB%98%E6%A9%8B%E3%81%97%E3%82%87%E3%81%86%E5%AD%902018%E5%B9%B4.jpg',
'水卜樱': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Miurasakuraj588830904.2.png/250px-Miurasakuraj588830904.2.png',
'桃乃木香奈': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/95/180727_%E9%BE%8D%E3%81%8C%E5%A6%82%E3%81%8F3_%E3%83%95%E3%82%A1%E3%83%B3%E4%BC%9A%E8%AD%B02_%2820%29.jpg/250px-180727_%E9%BE%8D%E3%81%8C%E5%A6%82%E3%81%8F3_%E3%83%95%E3%82%A1%E3%83%B3%E4%BC%9A%E8%AD%B02_%2820%29.jpg',
'相泽南': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/AV%E5%A5%B3%E5%84%AA%E3%83%BB%E7%9B%B8%E6%B2%A2%E3%81%BF%E3%81%AA%E3%81%BF.png/250px-AV%E5%A5%B3%E5%84%AA%E3%83%BB%E7%9B%B8%E6%B2%A2%E3%81%BF%E3%81%AA%E3%81%BF.png',
'山岸逢花': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/%E5%B1%B1%E5%B2%B8%E9%80%A2%E8%8A%B12018%E5%B9%B4.jpg/250px-%E5%B1%B1%E5%B2%B8%E9%80%A2%E8%8A%B12018%E5%B9%B4.jpg',
'神宫寺奈绪': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/TRE20250810Videoframe_477481.png/250px-TRE20250810Videoframe_477481.png',
'枫花恋': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/%E6%A5%93%E3%82%AB%E3%83%AC%E3%83%B32019%E5%B9%B401%E6%9C%8824%E6%97%A503%E6%99%8216%E5%88%8620%E7%A7%920003-1.png/250px-%E6%A5%93%E3%82%AB%E3%83%AC%E3%83%B32019%E5%B9%B401%E6%9C%8824%E6%97%A503%E6%99%8216%E5%88%8620%E7%A7%920003-1.png',
'伊藤舞雪': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Mayuki_Ito_IMG-6020-1.jpg/250px-Mayuki_Ito_IMG-6020-1.jpg',
'美谷朱里': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Akari_Mitani_IMG_5811-2.jpg/250px-Akari_Mitani_IMG_5811-2.jpg',
'白桃花': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/26/Hana_Shirato_Media2022.png/250px-Hana_Shirato_Media2022.png',
'苍井空': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7a/Aoi_Sora_%22Lazy_Hazy_Crazy%22_at_Opening_Ceremony_of_the_28th_Tokyo_International_Film_Festival_%2822241441840%29_%28cropped%29.jpg/250px-Aoi_Sora_%22Lazy_Hazy_Crazy%22_at_Opening_Ceremony_of_the_28th_Tokyo_International_Film_Festival_%2822241441840%29_%28cropped%29.jpg',
};

// 女优头像：有公开照片就显示圆形头像，加载失败或没有照片时用首字彩色圆圈兜底
function ActressAvatar({ name, active }: { name: string; active: boolean }) {
const [failed, setFailed] = useState(false);
const url = ACTRESS_AVATARS[name];
if (!url || failed) {
return (
<span
className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold ${
active
? 'bg-green-600 text-white'
: 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
}`}
>
{name.charAt(0)}
</span>
);
}
return (
<img
src={url}
alt={name}
loading='lazy'
referrerPolicy='no-referrer'
onError={() => setFailed(true)}
className={`h-14 w-14 rounded-full object-cover object-top ${
active
? 'ring-2 ring-green-600 ring-offset-2 dark:ring-offset-gray-900'
: 'ring-1 ring-gray-200 dark:ring-gray-700'
}`}
/>
);
}

function filterAvAndDedupe(list: AvResult[]): {
deduped: AvResult[];
rawCount: number;
} {
const avOnly = list.filter((item) => isAvResult(item));
return { deduped: dedupeResults(avOnly), rawCount: avOnly.length};
}

export default function AvPageClient() {
const [keyword, setKeyword] = useState(DEFAULT_ACTRESS);
const [inputValue, setInputValue] = useState(DEFAULT_ACTRESS);
const [results, setResults] = useState<AvResult[]>([]);
const [rawCount, setRawCount] = useState(0);
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
// 每个女优的去重后作品数（搜索接口只返回第一页，所以是第一页的去重数）
const [counts, setCounts] = useState<Record<string, number>>({});
const [rankingDone, setRankingDone] = useState(false);
const abortRef = useRef<AbortController | null>(null);

const doSearch = useCallback(async (name: string) => {
const trimmed = name.trim();
if (!trimmed) {
return;
}
abortRef.current?.abort();
const controller = new AbortController();
abortRef.current = controller;
setLoading(true);
setError('');
setVisibleCount(PAGE_SIZE);
try {
const res = await fetch(
`/api/search?q=${encodeURIComponent(trimmed)}`,
{ signal: controller.signal}
);
if (!res.ok) {
throw new Error('搜索失败');
}
const data = await res.json();
const list: AvResult[] = Array.isArray(data.results)
? data.results
: [];
const { deduped, rawCount: raw} = filterAvAndDedupe(list);
setResults(deduped);
setRawCount(raw);
} catch (err) {
if ((err as Error).name!== 'AbortError') {
setError('搜索失败，请稍后重试');
setResults([]);
setRawCount(0);
}
} finally {
if (abortRef.current === controller) {
setLoading(false);
}
}
}, []);

// 首次打开默认搜第一个热门女优
useEffect(() => {
doSearch(DEFAULT_ACTRESS);
return () => {
abortRef.current?.abort();
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// 女优按作品数排序：并行（限流 4）查每个女优的去重后作品数，
// 数到了就实时重排，没数到的排在后面；结果缓存，不会重复查
useEffect(() => {
let cancelled = false;
const queue = [...PINNED_ACTRESSES, ...ACTRESSES];
const workers = Array.from({ length: RANK_CONCURRENCY}, async () => {
while (queue.length > 0 &&!cancelled) {
const name = queue.shift()!;
try {
const res = await fetch(
`/api/search?q=${encodeURIComponent(searchNameFor(name))}`
);
if (!res.ok) {
continue;
}
const data = await res.json();
const list: AvResult[] = Array.isArray(data.results)
? data.results
: [];
const { deduped} = filterAvAndDedupe(list);
if (!cancelled) {
setCounts((prev) => ({...prev, [name]: deduped.length}));
}
} catch {
// 单个女优统计失败不影响其他人，也不阻塞页面
}
}
});
Promise.all(workers).then(() => {
if (!cancelled) {
setRankingDone(true);
}
});
return () => {
cancelled = true;
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// 已统计的按作品数从多到少排前面，未统计完的按原顺序排后面
const orderedActresses = useMemo(() => {
const ranked = ACTRESSES.filter((a) => counts[a]!== undefined).sort(
(a, b) => (counts[b]?? 0) - (counts[a]?? 0)
);
const pending = ACTRESSES.filter((a) => counts[a] === undefined);
// 置顶 9 位固定在最前面（顺序不变），其余按作品数从多到少
return [...PINNED_ACTRESSES, ...ranked, ...pending];
}, [counts]);

const handleSelectActress = (name: string) => {
setKeyword(name);
setInputValue(name);
doSearch(searchNameFor(name));
};

const handleSubmit = (e: React.FormEvent) => {
e.preventDefault();
setKeyword(inputValue.trim());
doSearch(inputValue);
};

const visibleResults = results.slice(0, visibleCount);

return (
<PageLayout activePath='/av'>
<div className='px-4 py-4 sm:px-6'>
{/* 标题 + 搜索框 */}
<div className='mb-4 flex items-center gap-2'>
<Flame className='h-6 w-6 text-green-600 dark:text-green-400' />
<h1 className='text-xl font-bold text-gray-900 dark:text-white'>
AV 女优
</h1>
<span className='text-sm text-gray-500 dark:text-gray-400'>
点女优名直接看她的片
</span>
</div>

<form onSubmit={handleSubmit} className='mb-4 flex gap-2'>
<div className='relative flex-1'>
<Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
<input
value={inputValue}
onChange={(e) => setInputValue(e.target.value)}
placeholder='输入女优名或番号，如 三上悠亜 / SONE-593'
className='w-full rounded-full border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
/>
</div>
<button
type='submit'
className='shrink-0 rounded-full bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700'
>
搜索
</button>
</form>

{/* 热门女优（按作品数从多到少排列） */}
<div className='mb-1 flex items-center gap-2'>
<span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
热门女优
</span>
<span className='text-xs text-gray-400 dark:text-gray-500'>
{rankingDone
? '前 9 位置顶，其余已按作品数从多到少排列'
: '正在按作品数排序…'}
</span>
</div>
<div className='mb-5 grid grid-cols-5 gap-x-2 gap-y-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9'>
{orderedActresses.map((name) => {
const active = keyword === name;
const count = counts[name];
return (
<button
key={name}
type='button'
onClick={() => handleSelectActress(name)}
className='flex flex-col items-center gap-1.5'
>
<ActressAvatar name={name} active={active} />
<span
className={`max-w-full truncate text-xs ${
active
? 'font-medium text-green-600 dark:text-green-400'
: 'text-gray-700 dark:text-gray-200'
}`}
>
{name}
</span>
{count!== undefined && (
<span className='-mt-1 text-[11px] text-gray-400 dark:text-gray-500'>
{count} 部
</span>
)}
</button>
);
})}
</div>

{/* 结果 */}
{loading? (
<div className='flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400'>
<Loader2 className='mb-2 h-8 w-8 animate-spin' />
<p className='text-sm'>正在搜索「{keyword}」的影片…</p>
</div>
): error? (
<div className='py-16 text-center text-sm text-red-500'>{error}</div>
): results.length === 0? (
<div className='py-16 text-center text-sm text-gray-500 dark:text-gray-400'>
没找到「{keyword}」的影片，换个名字或番号试试
</div>
): (
<>
<p className='mb-3 text-sm text-gray-500 dark:text-gray-400'>
「{keyword}」共 {results.length} 部
{rawCount > results.length &&
`（6 个源共 ${rawCount} 条，已去重 ${rawCount - results.length} 条重复）`}
</p>
<div className='grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
{visibleResults.map((item) => (
<div key={`${item.source}-${item.id}`} className='w-full'>
<VideoCard
id={item.id}
title={item.title}
poster={item.poster || ''}
episodes={
Array.isArray(item.episodes)
? item.episodes.length
: undefined
}
source={item.source}
source_name={item.source_name}
query={keyword.trim()!== item.title? keyword.trim(): ''}
year={item.year}
from='search'
type='movie'
typeName={item.type_name}
/>
</div>
))}
</div>
{visibleCount < results.length && (
<div className='mt-6 text-center'>
<button
type='button'
onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
className='rounded-full border border-gray-300 px-6 py-2 text-sm text-gray-700 hover:border-green-500 hover:text-green-600 dark:border-gray-600 dark:text-gray-200'
>
加载更多（还剩 {results.length - visibleCount} 部）
</button>
</div>
)}
</>
)}
</div>
</PageLayout>
);
}
