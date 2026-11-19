/* 搜索共享缓存：搜过的词存进 Neon（global_config 表），所有函数实例共用，
   重复搜直接读库，不用再等 11 个源。冷启动的实例也能命中。
   存的是没过滤过的原始结果，取出来时再按当前用户的成人权限过滤，
   不同权限的用户共用一份缓存也不会串味。
   写法照搬 Bangumi 时刻表缓存那套（global_config + cachedAt + 调用方验 TTL）。 */

import { DbManager } from '@/lib/db';

export interface CachedSearchSource {
  source: string;
  sourceName: string;
  results: any[];
}

export interface SearchDbCacheEntry {
  q: string;
  cachedAt: number;
  sources: CachedSearchSource[];
}

const KEY_PREFIX = 'search:db:';
const TTL_MS = 30 * 60 * 1000; // 30 分钟：片库一天才更新几轮，30 分钟够新鲜
const MAX_RESULTS_PER_SOURCE = 30;
const MAX_ENTRY_BYTES = 256 * 1024; // 单条缓存超 256KB 就不存，免得撑爆 global_config

function makeKey(query: string): string {
  return KEY_PREFIX + query.trim();
}

export async function getSearchDbCache(
  query: string
): Promise<SearchDbCacheEntry | null> {
  try {
    const raw = await new DbManager().getGlobalValue(makeKey(query));
    if (!raw) return null;
    const entry = JSON.parse(raw) as SearchDbCacheEntry;
    if (!entry || entry.q !== query.trim()) return null;
    if (Date.now() - entry.cachedAt > TTL_MS) return null;
    if (!Array.isArray(entry.sources)) return null;
    return entry;
  } catch (error) {
    console.warn('[SearchDbCache] 读缓存失败:', error);
    return null;
  }
}

export async function setSearchDbCache(
  query: string,
  sources: CachedSearchSource[]
): Promise<void> {
  try {
    // 空结果不存：存了空，下次搜会误以为这个源没片，直接跳过它
    const trimmed = sources
      .filter((s) => Array.isArray(s.results) && s.results.length > 0)
      .map((s) => ({ ...s, results: s.results.slice(0, MAX_RESULTS_PER_SOURCE) }));
    if (trimmed.length === 0) return;
    const entry: SearchDbCacheEntry = {
      q: query.trim(),
      cachedAt: Date.now(),
      sources: trimmed,
    };
    const raw = JSON.stringify(entry);
    if (raw.length > MAX_ENTRY_BYTES) return;
    await new DbManager().setGlobalValue(makeKey(query), raw);
  } catch (error) {
    console.warn('[SearchDbCache] 写缓存失败:', error);
  }
}
