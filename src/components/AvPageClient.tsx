'use client';

import { Flame, Loader2, Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

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

// 热门女优（点一下即按名字搜索 AV 源）
const ACTRESSES = [
  '三上悠亚',
  '河北彩花',
  '深田咏美',
  '明日花绮罗',
  '桥本有菜',
  '波多野结衣',
  '松本一香',
  '石川澪',
  '樱空桃',
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

const DEFAULT_ACTRESS = '三上悠亚';
const PAGE_SIZE = 30;

interface AvResult {
  id: string;
  source: string;
  source_name: string;
  title: string;
  poster: string;
  year?: string;
  type_name?: string;
  episodes?: unknown[];
}

function isAvResult(item: AvResult): boolean {
  if (AV_SOURCE_KEYS.has(item.source)) {
    return true;
  }
  return AV_SOURCE_NAMES.some((name) => item.source_name === name);
}

export default function AvPageClient() {
  const [keyword, setKeyword] = useState(DEFAULT_ACTRESS);
  const [inputValue, setInputValue] = useState(DEFAULT_ACTRESS);
  const [results, setResults] = useState<AvResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
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
        { signal: controller.signal }
      );
      if (!res.ok) {
        throw new Error('搜索失败');
      }
      const data = await res.json();
      const list: AvResult[] = Array.isArray(data.results)
        ? data.results
        : [];
      // 只保留 AV 源的结果，并按 source + id 去重
      const seen = new Set<string>();
      const avOnly = list.filter((item) => {
        if (!isAvResult(item) || !item.id || !item.source) {
          return false;
        }
        const key = `${item.source}:${item.id}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      setResults(avOnly);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('搜索失败，请稍后重试');
        setResults([]);
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

  const handleSelectActress = (name: string) => {
    setKeyword(name);
    setInputValue(name);
    doSearch(name);
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
              placeholder='输入女优名或番号，如 三上悠亚 / SONE-593'
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

        {/* 热门女优 */}
        <div className='mb-5 flex flex-wrap gap-2'>
          {ACTRESSES.map((name) => {
            const active = keyword === name;
            return (
              <button
                key={name}
                type='button'
                onClick={() => handleSelectActress(name)}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-green-600 font-medium text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>

        {/* 结果 */}
        {loading ? (
          <div className='flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400'>
            <Loader2 className='mb-2 h-8 w-8 animate-spin' />
            <p className='text-sm'>正在搜索「{keyword}」的影片…</p>
          </div>
        ) : error ? (
          <div className='py-16 text-center text-sm text-red-500'>{error}</div>
        ) : results.length === 0 ? (
          <div className='py-16 text-center text-sm text-gray-500 dark:text-gray-400'>
            没找到「{keyword}」的影片，换个名字或番号试试
          </div>
        ) : (
          <>
            <p className='mb-3 text-sm text-gray-500 dark:text-gray-400'>
              「{keyword}」共 {results.length} 部
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
                    query={keyword.trim() !== item.title ? keyword.trim() : ''}
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
