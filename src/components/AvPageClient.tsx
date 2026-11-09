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
return SEARCH_NAME_MAP[displayName]?? displayName;
}

// 女优罩杯（公开来源核实：维基百科 / 快楽プロ AV検定罩杯分类页 / 各女优资料站）。
// '' = 没查到可靠来源，不瞎猜，页面显示“罩杯未知”。
// 城崎百濑（城ヶ崎百瀬）为 N 罩杯，归入 K+；明日花绮罗各来源有 E/G 之争，
// 以快楽プロ AV検定 + av-joyu-db 的 E 为准。
const ACTRESS_CUP: Record<string, string> = {
// 精选 9 位
'鷲尾芽衣': 'J',
'佐山爱': 'H',
'三上悠亜': 'F',
'奥田咲': 'G',
'城崎百濑': 'N',
'桜空もも': 'G',
'雏之花音': '',
'北岛玲': 'G',
'乙爱丽丝': 'H',
// 原有 18 位
'河北彩花': 'E',
'深田咏美': 'F',
'明日花绮罗': 'E',
'桥本有菜': 'C',
'波多野结衣': 'E',
'松本一香': 'A',
'石川澪': 'B',
'高桥圣子': 'G',
'水卜樱': 'G',
'桃乃木香奈': 'F',
'相泽南': 'C',
'山岸逢花': 'C',
'神宫寺奈绪': 'D',
'枫花恋': 'D',
'伊藤舞雪': 'F',
'美谷朱里': 'E',
'白桃花': 'C',
'苍井空': 'G',
// 扩充：F
'篠田优': 'F',
'莲实克莱尔': 'F',
'羽咲美晴': 'F',
'AIKA': 'F',
'五月芽衣': 'F',
'森泽佳奈': 'F',
'枫富爱': 'F',
'七森莉莉': 'F',
'君岛美绪': 'F',
'柏木小夏': 'F',
'风间由美': 'F',
'小花暖': 'F',
'岬梓': 'F',
'优梨舞奈': 'F',
'梓光莉': 'F',
'晶艾莉': 'F',
'斋藤亚美里': 'F',
'铃木心春': 'F',
'望月绫香': 'F',
'纱仓真菜': 'F',
'大浦真奈美': 'F',
'二叶惠玛': 'F',
'羽月希': 'F',
// 扩充：G
'梦乃爱华': 'G',
'弥生美月': 'G',
'藤森里穗': 'G',
'葵伊吹': 'G',
'天音真比奈': 'G',
'黑川堇': 'G',
'水野朝阳': 'G',
'三宫椿': 'G',
'松下纱荣子': 'G',
'友田真希': 'G',
'宍户里帆': 'G',
'乃木萤': 'G',
'白石茉莉奈': 'G',
'三原穗花': 'G',
'神木丽': 'G',
'爱宝铃': 'G',
'永井玛利亚': 'G',
'北川绘里香': 'G',
'翼舞': 'G',
// 扩充：H
'稻场流花': 'H',
'小宵虎南': 'H',
'Unpai': 'H',
'北野未奈': 'H',
'仓多真央': 'H',
'辻井穗乃果': 'H',
'月野霞': 'H',
'逢见梨香': 'H',
'中山文香': 'H',
'橘玛丽': 'H',
'小日向美优': 'H',
'织田真子': 'H',
'麻美由真': 'H',
'笹仓杏': 'H',
'蒂亚': 'H',
// 扩充：E
'沙月惠奈': 'E',
'miru': 'E',
'滨崎真绪': 'E',
'根尾明里': 'E',
'八木奈奈': 'E',
'小岛南': 'E',
'葵司': 'E',
'七濑爱丽丝': 'E',
'椎名空': 'E',
'八乃翼': 'E',
'天海翼': 'E',
'横宫七海': 'E',
'美咲佳奈': 'E',
'有村希': 'E',
'河南实里': 'E',
'木下凛凛子': 'E',
'通野未帆': 'E',
'蓝芽水树': 'E',
// 扩充：D
'架乃由罗': 'D',
'枢木葵': 'D',
'大槻响': 'D',
'木下日葵': 'D',
'蕾': 'D',
'佐藤乃乃花': 'D',
'初川南': 'D',
'麻里梨夏': 'D',
'奏音花音': 'D',
'西宫梦': 'D',
'末广纯': 'D',
'加美杏奈': 'D',
'星宫一花': 'D',
'希崎杰西卡': 'D',
'川上优': 'D',
// 扩充：C
'七泽美亚': 'C',
'小野六花': 'C',
'东条夏': 'C',
'月乃露娜': 'C',
'葵玲奈': 'C',
'久留木玲': 'C',
'花狩舞': 'C',
'希岛爱里': 'C',
'香水纯': 'C',
'天马唯': 'C',
'阿部乃美久': 'C',
'有坂深雪': 'C',
'绀野光': 'C',
'吉高宁宁': 'C',
'本庄铃': 'C',
// 扩充：J
'JULIA': 'J',
'汐世': 'J',
'日下部加奈': 'J',
'安斋拉拉': 'J',
'夕季千岁': 'J',
'冢田诗织': 'J',
'筧纯': 'J',
'凪光': 'J',
'仁科百华': 'J',
'上羽绚': 'J',
'希咲爱丽丝': 'J',
'菅野沙雪': 'J',
'西村妮娜': 'J',
// 扩充：B
'皆月光': 'B',
'明里紬': 'B',
'跡美朱里': 'B',
'荣川乃亚': 'B',
'宫泽千春': 'B',
'碧志乃': 'B',
'渚光希': 'B',
'樱木优希音': 'B',
'西田卡莉娜': 'B',
'并木塔子': 'B',
};

// 精选之外的全部女优（原有 18 位 + 扩充 128 位，共 146 位）
const REST_ACTRESSES = [
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
'篠田优',
'莲实克莱尔',
'羽咲美晴',
'AIKA',
'五月芽衣',
'森泽佳奈',
'枫富爱',
'七森莉莉',
'君岛美绪',
'柏木小夏',
'风间由美',
'小花暖',
'岬梓',
'优梨舞奈',
'梓光莉',
'晶艾莉',
'斋藤亚美里',
'铃木心春',
'望月绫香',
'纱仓真菜',
'大浦真奈美',
'二叶惠玛',
'羽月希',
'梦乃爱华',
'弥生美月',
'藤森里穗',
'葵伊吹',
'天音真比奈',
'黑川堇',
'水野朝阳',
'三宫椿',
'松下纱荣子',
'友田真希',
'宍户里帆',
'乃木萤',
'白石茉莉奈',
'三原穗花',
'神木丽',
'爱宝铃',
'永井玛利亚',
'北川绘里香',
'翼舞',
'稻场流花',
'小宵虎南',
'Unpai',
'北野未奈',
'仓多真央',
'辻井穗乃果',
'月野霞',
'逢见梨香',
'中山文香',
'橘玛丽',
'小日向美优',
'织田真子',
'麻美由真',
'笹仓杏',
'蒂亚',
'沙月惠奈',
'miru',
'滨崎真绪',
'根尾明里',
'八木奈奈',
'小岛南',
'葵司',
'七濑爱丽丝',
'椎名空',
'八乃翼',
'天海翼',
'横宫七海',
'美咲佳奈',
'有村希',
'河南实里',
'木下凛凛子',
'通野未帆',
'蓝芽水树',
'架乃由罗',
'枢木葵',
'大槻响',
'木下日葵',
'蕾',
'佐藤乃乃花',
'初川南',
'麻里梨夏',
'奏音花音',
'西宫梦',
'末广纯',
'加美杏奈',
'星宫一花',
'希崎杰西卡',
'川上优',
'七泽美亚',
'小野六花',
'东条夏',
'月乃露娜',
'葵玲奈',
'久留木玲',
'花狩舞',
'希岛爱里',
'香水纯',
'天马唯',
'阿部乃美久',
'有坂深雪',
'绀野光',
'吉高宁宁',
'本庄铃',
'JULIA',
'汐世',
'日下部加奈',
'安斋拉拉',
'夕季千岁',
'冢田诗织',
'筧纯',
'凪光',
'仁科百华',
'上羽绚',
'希咲爱丽丝',
'菅野沙雪',
'西村妮娜',
'皆月光',
'明里紬',
'跡美朱里',
'荣川乃亚',
'宫泽千春',
'碧志乃',
'渚光希',
'樱木优希音',
'西田卡莉娜',
'并木塔子',
];

// 全部女优：精选 9 位 + 其余 146 位 = 155 位
const ALL_ACTRESSES = [...PINNED_ACTRESSES,...REST_ACTRESSES];

const CUP_FILTERS = [
'全部',
'A',
'B',
'C',
'D',
'E',
'F',
'G',
'H',
'I',
'J',
'K+',
'未知',
] as const;
type CupFilter = (typeof CUP_FILTERS)[number];

function matchesCup(cup: string, filter: CupFilter): boolean {
if (filter === '全部') return true;
if (filter === '未知') return cup === '';
if (filter === 'K+') return cup >= 'K'; // K/L/M/N…（城崎百濑 N 归入此类）
return cup === filter;
}

function cupLabel(cup: string): string {
return cup? `${cup}罩杯`: '罩杯未知';
}

const DEFAULT_ACTRESS = '三上悠亜';
const PAGE_SIZE = 30;
// 女优作品数统计的并发数：避免同时打爆服务端搜索
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
// （新增头像均取自各女优日文维基百科条目的页面图片，经核对为公开活动照；
// 签名图等非人像图片已排除，不在此表里。）
const ACTRESS_AVATARS: Record<string, string> = {
'三上悠亜': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Mikami_Yua_to_K-POP_CIMG6925_%28cropped%29.jpg/250px-Mikami_Yua_to_K-POP_CIMG6925_%28cropped%29.jpg',
'奥田咲': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Fresh_Summer_Fes%21%21_Gold_Division_IMG_9688.jpg/250px-Fresh_Summer_Fes%21%21_Gold_Division_IMG_9688.jpg',
'桜空もも': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/Tregal_Academy_Cultural_Festival_2026IMG_5386.jpg/250px-Tregal_Academy_Cultural_Festival_2026IMG_5386.jpg',
'乙爱丽丝': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/Fresh_Festival_2023_in_Shirakobato_Water_Park_IMG_2984.jpg/250px-Fresh_Festival_2023_in_Shirakobato_Water_Park_IMG_2984.jpg',
'河北彩花': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Trend_Girls_Photo_Session_%28September_28%2C_2025%29_IMG_3232.jpg/250px-Trend_Girls_Photo_Session_%28September_28%2C_2025%29_IMG_3232.jpg',
'深田咏美': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/20230804_Eimi_Fukada_%28%E6%B7%B1%E7%94%B0%E3%81%88%E3%81%84%E3%81%BF%29.jpg/250px-20230804_Eimi_Fukada_%28%E6%B7%B1%E7%94%B0%E3%81%88%E3%81%84%E3%81%BF%29.jpg',
'明日花绮罗': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/%EC%95%84%EC%8A%A4%EC%B9%B4_%ED%82%A4%EB%9D%BC%EB%9D%BC%28Kirara_Asuka%29_%ED%8C%AC%EB%AF%B8%ED%8C%85_%289%29.jpg/250px-%EC%95%84%EC%8A%A4%EC%B9%B4_%ED%82%A4%EB%9D%BC%EB%9D%BC%28Kirara_Asuka%29_%ED%8C%AC%EB%AF%B8%ED%8C%85_%289%29.jpg',
'桥本有菜': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/%E6%A9%8B%E6%9C%AC%E3%81%82%E3%82%8A%E3%81%AA.jpg/250px-%E6%A9%8B%E6%9C%AC%E3%81%82%E3%82%8A%E3%81%AA.jpg',
'波多野结衣': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/%ED%95%98%ED%83%80%EB%85%B8%EC%9C%A0%EC%9D%B4%28Yui_Hatano%29_%EC%9A%A9%EA%B3%BC%EA%B0%99%EC%9D%B4_%E5%BF%B5%ED%96%89%E4%BA%8B_4.jpg/250px-%ED%95%98%ED%83%80%EB%85%B8%EC%9C%A0%EC%9D%B4%28Yui_Hatano%29_%EC%9A%A9%EA%B3%BC%EA%B0%99%EC%9D%B4_%E5%BF%B5%ED%96%89%E4%BA%8B_4.jpg',
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
'三宫椿': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6f/Tsubaki_Sannomiya_Portrait_%282025%29.jpg/250px-Tsubaki_Sannomiya_Portrait_%282025%29.jpg',
'乃木萤': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/SHIBUYA_LOFT_9_CIMG4956.jpg/250px-SHIBUYA_LOFT_9_CIMG4956.jpg',
'二叶惠玛': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/Trend_Girls_Photo_Session_%28September_14%2C_2024%29IMG_2104.jpg/250px-Trend_Girls_Photo_Session_%28September_14%2C_2024%29IMG_2104.jpg',
'君岛美绪': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Trend_Girls_Photo_Session_%28September_15%2C_2024%29IMG_9344.jpg/250px-Trend_Girls_Photo_Session_%28September_15%2C_2024%29IMG_9344.jpg',
'梦乃爱华': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fe/Aika_Yumeno_%E5%A4%A2%E4%B9%83_%E3%81%82%E3%81%84%E3%81%8B.jpg/250px-Aika_Yumeno_%E5%A4%A2%E4%B9%83_%E3%81%82%E3%81%84%E3%81%8B.jpg',
'大浦真奈美': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Trend_Girls_Photo_Session_%28May_4%2C_2025%29IMG_0526.jpg/250px-Trend_Girls_Photo_Session_%28May_4%2C_2025%29IMG_0526.jpg',
'宍户里帆': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8e/Stage_greeting_for_the_film_%22The_Journey_of_an_Unknown_Rendezvous%22IMG_0395.jpg/250px-Stage_greeting_for_the_film_%22The_Journey_of_an_Unknown_Rendezvous%22IMG_0395.jpg',
'弥生美月': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/86/Kindai_Mahjong_Swimsuit_Festival_%28September_30%2C_2026%29IMG_8937.jpg/250px-Kindai_Mahjong_Swimsuit_Festival_%28September_30%2C_2026%29IMG_8937.jpg',
'斋藤亚美里': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/Kindai_Mahjong_Swimsuit_Festival_%28July_1%2C_2026%29IMG_8740.jpg/250px-Kindai_Mahjong_Swimsuit_Festival_%28July_1%2C_2026%29IMG_8740.jpg',
'晶艾莉': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f4/Y%C5%ABka_%C5%8Csawa_at_AVN_Adult_Entertainment_Expo_2008.jpg/250px-Y%C5%ABka_%C5%8Csawa_at_AVN_Adult_Entertainment_Expo_2008.jpg',
'望月绫香': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/19/Fresh_Festival_2023_in_Shirakobato_Water_Park_IMG_1178.jpg/250px-Fresh_Festival_2023_in_Shirakobato_Water_Park_IMG_1178.jpg',
'柏木小夏': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Trend_Girls_Photo_Session_%28September_27%2C_2025%29IMG_0708Konatsu_Kashiwagi.jpg/250px-Trend_Girls_Photo_Session_%28September_27%2C_2025%29IMG_0708Konatsu_Kashiwagi.jpg',
'森泽佳奈': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Movie_%E2%80%9CBlue_Porno%E2%80%9D_Stage_Greetings_Ikebukuro_Cinema_Rosa_IMG_9655-1.jpg/250px-Movie_%E2%80%9CBlue_Porno%E2%80%9D_Stage_Greetings_Ikebukuro_Cinema_Rosa_IMG_9655-1.jpg',
'枫富爱': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Fresh_Festival_2023_in_Shirakobato_Water_Park_IMG_1104.jpg/250px-Fresh_Festival_2023_in_Shirakobato_Water_Park_IMG_1104.jpg',
'白石茉莉奈': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e4/Shiraishi_Marina_from_%22I_am_a_pervert%22_at_Opening_Ceremony_of_the_Tokyo_International_Film_Festival_2016_%2832800542854%29.jpg/250px-Shiraishi_Marina_from_%22I_am_a_pervert%22_at_Opening_Ceremony_of_the_Tokyo_International_Film_Festival_2016_%2832800542854%29.jpg',
'神木丽': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Tregal_Academy_Cultural_Festival_2026IMG_5634.jpg/250px-Tregal_Academy_Cultural_Festival_2026IMG_5634.jpg',
'纱仓真菜': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Mana_Sakura%2C_2017_%28cropped%29.jpg/250px-Mana_Sakura%2C_2017_%28cropped%29.jpg',
'羽咲美晴': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/Yasuyuki_Totsuka_studio_photo_session_IMG_3822.jpg/250px-Yasuyuki_Totsuka_studio_photo_session_IMG_3822.jpg',
'葵伊吹': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/August_15%2C_2024%2C_%E2%80%9CModern_Mahjong_Academy%E2%80%9D%2C_Konosu_City%2C_Saitama_Prefecture_IMG_6758.jpg/250px-August_15%2C_2024%2C_%E2%80%9CModern_Mahjong_Academy%E2%80%9D%2C_Konosu_City%2C_Saitama_Prefecture_IMG_6758.jpg',
'莲实克莱尔': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Kurea_Hasumi%2C_2016_%28cropped%29.jpg/250px-Kurea_Hasumi%2C_2016_%28cropped%29.jpg',
'藤森里穗': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Trend_Girls_Photo_Session_%28September_27%2C_2025%29IMG_2740.jpg/250px-Trend_Girls_Photo_Session_%28September_27%2C_2025%29IMG_2740.jpg',
'铃木心春': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/SuzukiKoharu2018.png/250px-SuzukiKoharu2018.png',
'黑川堇': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5c/Japanese_pool_photo_session_model_IMG_5507.jpg/250px-Japanese_pool_photo_session_model_IMG_5507.jpg',
'Unpai': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Fresh_Festival_2023_in_Shirakobato_Water_Park_IMG_3023.jpg/250px-Fresh_Festival_2023_in_Shirakobato_Water_Park_IMG_3023.jpg',
'翼舞': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/70/FALENO_presents_Liberation%21_No-Bra-dio_June_27%2C_20261000002741.jpg/250px-FALENO_presents_Liberation%21_No-Bra-dio_June_27%2C_20261000002741.jpg',
'七濑爱丽丝': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Trend_Girls_Photo_Session_%28September_15%2C_2024%29IMG_9350.jpg/250px-Trend_Girls_Photo_Session_%28September_15%2C_2024%29IMG_9350.jpg',
'八木奈奈': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/53/January_24%2C_2026_%22Modern_Mahjong_Academy%22_in_Kawachi_Town%2C_Ibaraki_Prefecture_IMG_1952.jpg/250px-January_24%2C_2026_%22Modern_Mahjong_Academy%22_in_Kawachi_Town%2C_Ibaraki_Prefecture_IMG_1952.jpg',
'北野未奈': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/Midsummer_Swimsuit_Festival_%28July_3%2C_2025%29DSC_6838.jpg/250px-Midsummer_Swimsuit_Festival_%28July_3%2C_2025%29DSC_6838.jpg',
'大槻响': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/73/Fresh_Festival_2023_in_Shirakobato_Water_Park_IMG_3414.jpg/250px-Fresh_Festival_2023_in_Shirakobato_Water_Park_IMG_3414.jpg',
'小宵虎南': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/Midsummer_Swimsuit_Festival_%28July_2%2C_2025%29IMG_4902.jpg/250px-Midsummer_Swimsuit_Festival_%28July_2%2C_2025%29IMG_4902.jpg',
'小日向美优': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fc/Bstar_Summer_Campaign_2023_Akihabara_Fureai_Conference_Room_IMG_8381-%E5%BE%A9%E5%85%83.jpg/250px-Bstar_Summer_Campaign_2023_Akihabara_Fureai_Conference_Room_IMG_8381-%E5%BE%A9%E5%85%83.jpg',
'木下日葵': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Trend_Girls_Photo_Session_%28May_4%2C_2025%29IMG_0693.jpg/250px-Trend_Girls_Photo_Session_%28May_4%2C_2025%29IMG_0693.jpg',
'木下凛凛子': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/Stage_greeting_for_the_movie_%22Love_in_the_Diary_Box%22IMG_0312.jpg/250px-Stage_greeting_for_the_movie_%22Love_in_the_Diary_Box%22IMG_0312.jpg',
'枢木葵': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Fresh_Summer_Fes%21%21_Gold_Division_IMG_0074.jpg/250px-Fresh_Summer_Fes%21%21_Gold_Division_IMG_0074.jpg',
'架乃由罗': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/51/Yura_Kano%27s_stage_greeting_IMG_4608.jpg/250px-Yura_Kano%27s_stage_greeting_IMG_4608.jpg',
'根尾明里': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Trend_Girls_Photo_Session_%28September_28%2C_2025%29_IMG_5331.jpg/250px-Trend_Girls_Photo_Session_%28September_28%2C_2025%29_IMG_5331.jpg',
'椎名空': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/Shiina_Sora_CIMG5165.jpg/250px-Shiina_Sora_CIMG5165.jpg',
'橘玛丽': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Mary_Tachibana.jpg/250px-Mary_Tachibana.jpg',
'沙月惠奈': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/93/Enako_presents_Muse_Photoshoot_%28June_21%2C_2025%29IMG_8322.jpg/250px-Enako_presents_Muse_Photoshoot_%28June_21%2C_2025%29IMG_8322.jpg',
'滨崎真绪': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/DSCF3777_%2853361773894%29.jpg/250px-DSCF3777_%2853361773894%29.jpg',
'笹仓杏': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Gravure_idol_photographed_on_May_9%2C_2026IMG_1234.jpg/250px-Gravure_idol_photographed_on_May_9%2C_2026IMG_1234.jpg',
'织田真子': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/%E7%B9%94%E7%94%B0%E7%9C%9F%E5%AD%90.jpg/250px-%E7%B9%94%E7%94%B0%E7%9C%9F%E5%AD%90.jpg',
'美咲佳奈': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/FALENO_presents_Liberation%21_No-Bra-dio_August_22%2C_2026IMG_4455.jpg/250px-FALENO_presents_Liberation%21_No-Bra-dio_August_22%2C_2026IMG_4455.jpg',
'葵司': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/88/%EC%95%84%EC%98%A4%EC%9D%B4%EC%B8%A0%EC%B9%B4%EC%82%AC%28Aoi_Tsukasa%29_%EA%B5%AD%EB%82%B4_%ED%8C%AC%EB%AF%B8%ED%8C%85_5.jpg/250px-%EC%95%84%EC%98%A4%EC%9D%B4%EC%B8%A0%EC%B9%B4%EC%82%AC%28Aoi_Tsukasa%29_%EA%B5%AD%EB%82%B4_%ED%8C%AC%EB%AF%B8%ED%8C%85_5.jpg',
'辻井穗乃果': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Trend_Girls_Photo_Session_%28May_4%2C_2025%29IMG_1501.jpg/250px-Trend_Girls_Photo_Session_%28May_4%2C_2025%29IMG_1501.jpg',
'通野未帆': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/32/Trend_Girls_Photo_Session_%28May_3%2C_2025%29Image_processing_IMG_1891.jpg/250px-Trend_Girls_Photo_Session_%28May_3%2C_2025%29Image_processing_IMG_1891.jpg',
'逢见梨香': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6a/Trend_Girls_Photo_Session_%28September_15%2C_2024%29IMG_8357.jpg/250px-Trend_Girls_Photo_Session_%28September_15%2C_2024%29IMG_8357.jpg',
'麻美由真': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/Asami_Yuma.jpg/250px-Asami_Yuma.jpg',
'七泽美亚': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Midsummer_Swimsuit_Festival_%28July_2%2C_2025%29IMG_2563.jpg/250px-Midsummer_Swimsuit_Festival_%28July_2%2C_2025%29IMG_2563.jpg',
'上羽绚': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/86/Aya_Ueha%2C_2024_%28cropped%29.jpg/250px-Aya_Ueha%2C_2024_%28cropped%29.jpg',
'初川南': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/%E5%88%9D%E5%B7%9D%E3%81%BF%E3%81%AA%E3%81%BFCIMG4158.jpg/250px-%E5%88%9D%E5%B7%9D%E3%81%BF%E3%81%AA%E3%81%BFCIMG4158.jpg',
'加美杏奈': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/RamutaraMEDIA_WORLD_AKIBA_IMG_1947-01.jpg/250px-RamutaraMEDIA_WORLD_AKIBA_IMG_1947-01.jpg',
'吉高宁宁': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Tregal_Academy_Cultural_Festival_2026IMG_5533.jpg/250px-Tregal_Academy_Cultural_Festival_2026IMG_5533.jpg',
'天马唯': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/48/Trend_Girls_Photo_Session_%28September_28%2C_2025%29_IMG_3931.jpg/250px-Trend_Girls_Photo_Session_%28September_28%2C_2025%29_IMG_3931.jpg',
'小野六花': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Nekomanma%21%21_from_Otsuki-chan_no_Uta_1st_single_mini_live_Tower_Records_Ikebukuro_store_IMG_4523.jpg/250px-Nekomanma%21%21_from_Otsuki-chan_no_Uta_1st_single_mini_live_Tower_Records_Ikebukuro_store_IMG_4523.jpg',
'希崎杰西卡': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8d/CIMG3734kisaki.jpg/250px-CIMG3734kisaki.jpg',
'日下部加奈': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Gravure_idol_photographed_on_May_10%2C_2026IMG_5867.jpg/250px-Gravure_idol_photographed_on_May_10%2C_2026IMG_5867.jpg',
'明里紬': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6f/Gravure_idol_photographed_on_May_10%2C_2026IMG_2264.jpg/250px-Gravure_idol_photographed_on_May_10%2C_2026IMG_2264.jpg',
'本庄铃': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/Suzu_Honjo%27s_refreshing_smile2024.jpg/250px-Suzu_Honjo%27s_refreshing_smile2024.jpg',
'东条夏': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Trend_Girls_Photo_Session_%28May_3%2C_2025%29IMG_5867.jpg/250px-Trend_Girls_Photo_Session_%28May_3%2C_2025%29IMG_5867.jpg',
'绀野光': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a0/Fresh_Festival_2023_in_Shirakobato_Water_Park_IMG_1060.jpg/250px-Fresh_Festival_2023_in_Shirakobato_Water_Park_IMG_1060.jpg',
'花狩舞': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Trend_Girls_Photo_Session_%28September_14%2C_2024%29IMG_2528.jpg/250px-Trend_Girls_Photo_Session_%28September_14%2C_2024%29IMG_2528.jpg',
'西宫梦': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/22/TRE2025NEWS_Videoframe_885CUTOUT.png/250px-TRE2025NEWS_Videoframe_885CUTOUT.png',
'阿部乃美久': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Abenomiku2018050202.jpg/250px-Abenomiku2018050202.jpg',
'香水纯': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Kindai_Mahjong_Swimsuit_Festival_%28October_1_%2C_2026%29IMG_2606.jpg/250px-Kindai_Mahjong_Swimsuit_Festival_%28October_1_%2C_2026%29IMG_2606.jpg',
'并木塔子': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Toko_Namiki%2C_30th_May_2020.jpg/250px-Toko_Namiki%2C_30th_May_2020.jpg',
'荣川乃亚': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bf/Trend_Girls_Photo_Session_%28September_14%2C_2024%29IMG_2059.jpg/250px-Trend_Girls_Photo_Session_%28September_14%2C_2024%29IMG_2059.jpg',
'樱木优希音': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/BOKURAWAUSOTSUKI_CIMG5700.jpg/250px-BOKURAWAUSOTSUKI_CIMG5700.jpg',
'渚光希': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/Kindai_Mahjong_Swimsuit_Festival_%28September_23%2C_2024%29IMG_9060.jpg/250px-Kindai_Mahjong_Swimsuit_Festival_%28September_23%2C_2024%29IMG_9060.jpg',
'西田卡莉娜': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bd/Virgin_concerto_20191005_155011.jpg/250px-Virgin_concerto_20191005_155011.jpg',
'跡美朱里': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/TANASHI_CIMG5169.jpg/250px-TANASHI_CIMG5169.jpg',
'末广纯': 'https://upload.wikimedia.org/wikipedia/commons/b/bc/20230804_TRE_%E5%8F%B0%E5%8C%97%E5%9C%8B%E9%9A%9B%E6%88%90%E4%BA%BA%E5%B1%9511-2.jpg',
};

// 女优头像：有公开照片就显示圆形头像，加载失败或没有照片时用首字彩色圆圈兜底
function ActressAvatar({ name, active}: { name: string; active: boolean}) {
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

// 女优卡片：头像 + 名字 + 罩杯 + 作品数（点一下搜她的片）
function ActressButton({
name,
active,
count,
onSelect,
}: {
name: string;
active: boolean;
count?: number;
onSelect: (name: string) => void;
}) {
const cup = ACTRESS_CUP[name]?? '';
return (
<button
type='button'
onClick={() => onSelect(name)}
className='flex flex-col items-center gap-1'
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
<span
className={`-mt-0.5 text-[11px] ${
cup
? 'text-gray-400 dark:text-gray-500'
: 'text-gray-300 dark:text-gray-600'
}`}
>
{cupLabel(cup)}
{count!== undefined? ` · ${count} 部`: ''}
</span>
</button>
);
}

function filterAvAndDedupe(list: AvResult[]): {
deduped: AvResult[];
rawCount: number;
} {
const avOnly = list.filter((item) => isAvResult(item));
return { deduped: dedupeResults(avOnly), rawCount: avOnly.length};
}

// 成人直播 · 轮播台：13 个轮播台，点台名进 /live 播放。
// 数据走 /api/live/channels?source=av_live（服务端已按成人权限拦截，
// 无权限的用户拿不到频道，整行直接不显示）。DB 里还没配 av_live 源时
// 接口会 404，同样不显示，不影响女优区。
const ADULT_LIVE_SOURCE_KEY = 'av_live';

type AdultLiveChannel = {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
};

function AdultLiveRow() {
  const [channels, setChannels] = useState<AdultLiveChannel[] | null>(null);
  const [logoFailed, setLogoFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/live/channels?source=${ADULT_LIVE_SOURCE_KEY}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const list: AdultLiveChannel[] = Array.isArray(data.data)
          ? data.data
          : [];
        if (!cancelled && list.length > 0) setChannels(list);
      } catch {
        // 源未配置或网络失败：整行隐藏，不影响女优区
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!channels || channels.length === 0) return null;

  return (
    <>
      <div className='mb-1 flex items-center gap-2'>
        <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          成人直播 · 轮播台
        </span>
        <span className='text-xs text-gray-400 dark:text-gray-500'>
          24 小时轮播，点台名直接看
        </span>
      </div>
      <div className='mb-5 flex gap-3 overflow-x-auto pb-1'>
        {channels.map((ch) => {
          const showLogo = ch.logo && !logoFailed[ch.id];
          return (
            <a
              key={ch.id}
              href={`/live?source=${ADULT_LIVE_SOURCE_KEY}&id=${encodeURIComponent(ch.id)}`}
              className='relative flex w-20 shrink-0 flex-col items-center gap-1'
            >
              {showLogo ? (
                <img
                  src={`/api/proxy/logo?url=${encodeURIComponent(ch.logo)}&source=${ADULT_LIVE_SOURCE_KEY}`}
                  alt={ch.name}
                  loading='lazy'
                  referrerPolicy='no-referrer'
                  onError={() =>
                    setLogoFailed((prev) => ({ ...prev, [ch.id]: true }))
                  }
                  className='h-14 w-14 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700'
                />
              ) : (
                <span className='flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-xl font-bold text-gray-500 dark:bg-gray-700 dark:text-gray-300'>
                  {ch.name.charAt(0)}
                </span>
              )}
              <span className='absolute right-1 top-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white'>
                LIVE
              </span>
              <span className='max-w-full truncate text-xs text-gray-700 dark:text-gray-200'>
                {ch.name}
              </span>
            </a>
          );
        })}
      </div>
    </>
  );
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
const [counting, setCounting] = useState(false);
const [cupFilter, setCupFilter] = useState<CupFilter>('A');
const abortRef = useRef<AbortController | null>(null);
const countsRef = useRef<Record<string, number>>({});
useEffect(() => {
countsRef.current = counts;
}, [counts]);

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

// 当前罩杯筛选下的女优列表
const filteredActresses = useMemo(() => {
return ALL_ACTRESSES.filter((name) =>
matchesCup(ACTRESS_CUP[name]?? '', cupFilter)
);
}, [cupFilter]);

// 各罩杯的人数（筛选 chips 上显示）
const cupCounts = useMemo(() => {
const map = new Map<CupFilter, number>();
for (const f of CUP_FILTERS) {
map.set(
f,
ALL_ACTRESSES.filter((name) =>
matchesCup(ACTRESS_CUP[name]?? '', f)
).length
);
}
return map;
}, []);

// 女优按作品数排序：只统计当前筛选出的女优（分批、限流 4），
// 数到了就实时重排，没数到的排在后面；结果缓存，切换筛选不重复查。
// 切筛选时取消上一批未完成的统计。
useEffect(() => {
let cancelled = false;
const queue = filteredActresses.filter(
(name) => countsRef.current[name] === undefined
);
if (queue.length === 0) {
setCounting(false);
return;
}
setCounting(true);
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
setCounting(false);
}
});
return () => {
cancelled = true;
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [cupFilter]);

// 已统计的按作品数从多到少排前面，未统计完的按原顺序排后面
const orderedActresses = useMemo(() => {
const ranked = filteredActresses
.filter((a) => counts[a]!== undefined)
.sort((a, b) => (counts[b]?? 0) - (counts[a]?? 0));
const pending = filteredActresses.filter((a) => counts[a] === undefined);
return [...ranked,...pending];
}, [counts, filteredActresses]);

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
点女优头像直接看她的片
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

{/* 精选：用户点名的 9 位，顺序不变，不受罩杯筛选影响，永远在最上方 */}
<div className='mb-1 flex items-center gap-2'>
<span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
精选
</span>
<span className='text-xs text-gray-400 dark:text-gray-500'>
你点名的 9 位，顺序不变
</span>
</div>
<div className='mb-5 grid grid-cols-5 gap-x-2 gap-y-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9'>
{PINNED_ACTRESSES.map((name) => (
<ActressButton
key={name}
name={name}
active={keyword === name}
count={counts[name]}
onSelect={handleSelectActress}
/>
))}
</div>

{/* 成人直播 · 轮播台：横滑一行，在精选下方、罩杯筛选上方，不进罩杯过滤 */}
<AdultLiveRow />

{/* 罩杯筛选 */}
<div className='mb-1 flex items-center gap-2'>
<span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
按罩杯筛选
</span>
<span className='text-xs text-gray-400 dark:text-gray-500'>
共 {ALL_ACTRESSES.length} 位女优
</span>
</div>
<div className='mb-4 flex gap-2 overflow-x-auto pb-1'>
{CUP_FILTERS.map((f) => {
const active = cupFilter === f;
const n = cupCounts.get(f)?? 0;
return (
<button
key={f}
type='button'
onClick={() => setCupFilter(f)}
className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${
active
? 'bg-green-600 font-medium text-white'
: 'border border-gray-300 text-gray-700 hover:border-green-500 hover:text-green-600 dark:border-gray-600 dark:text-gray-200'
}`}
>
{f === '全部'? '全部': f === '未知'? '未知': `${f}罩杯`}
<span className='ml-1 text-xs opacity-70'>{n}</span>
</button>
);
})}
</div>

{/* 全部女优：按当前罩杯筛选，作品数从多到少排列 */}
<div className='mb-1 flex items-center gap-2'>
<span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
全部女优
</span>
<span className='text-xs text-gray-400 dark:text-gray-500'>
{cupFilter === '全部'
? `共 ${filteredActresses.length} 位`
: `${cupFilter === '未知'? '罩杯未知': `${cupFilter}罩杯`} · ${filteredActresses.length} 位`}
{counting? '，正在按作品数排序…': '，已按作品数从多到少排列'}
</span>
</div>
{orderedActresses.length === 0? (
<p className='mb-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400'>
该罩杯暂无收录女优，换个罩杯试试
</p>
): (
<div className='mb-5 grid grid-cols-5 gap-x-2 gap-y-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9'>
{orderedActresses.map((name) => (
<ActressButton
key={name}
name={name}
active={keyword === name}
count={counts[name]}
onSelect={handleSelectActress}
/>
))}
</div>
)}

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
