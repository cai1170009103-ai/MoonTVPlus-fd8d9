/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { API_CONFIG } from '@/lib/config';
import { getDuanjuSources } from '@/lib/duanju';
import { parseJsonLosslessIntegers } from '@/lib/json';
import { SearchResult } from '@/lib/types';
import { cleanHtmlTags } from '@/lib/utils';

export const runtime = 'nodejs';

// 服务端内存缓存：按类型分开存（真人 / AI），各 5 分钟
let cachedRecommends: Record<
  string,
  { timestamp: number; data: SearchResult[] }
> = {};

interface ApiSearchItem {
  vod_id: string | number;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_play_url?: string;
  vod_class?: string;
  vod_year?: string;
  vod_content?: string;
  vod_douban_id?: number;
  type_name?: string;
}

interface CmsClassItem {
  type_id: string | number;
  type_pid?: string | number;
  type_name: string;
}

interface CmsClassResponse {
  class?: CmsClassItem[];
}

// 请求指定分类下的视频列表
const fetchVideoList = async (api: string, typeId: string | number) => {
  const response = await fetch(`${api}?ac=videolist&t=${typeId}&pg=1`, {
    headers: API_CONFIG.search.headers,
  });
  if (!response.ok) return null;
  const data = parseJsonLosslessIntegers<{ list?: ApiSearchItem[] }>(
    await response.text()
  );
  if (!data?.list || !Array.isArray(data.list)) return null;
  return data.list as ApiSearchItem[];
};

/**
 * 获取热播短剧推荐视频
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') === 'ai' ? 'ai' : 'real';

    // 检查内存缓存
    const now = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 分钟，热门榜常新

    const cached = cachedRecommends[mode];
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      console.log(`使用缓存的短剧推荐数据 (${mode})`);
      const cacheTime = 300; // 5 分钟，与服务端内存缓存一致
      return NextResponse.json(
        {
          code: 200,
          message: '获取成功',
          data: cached.data,
        },
        {
          headers: {
            'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          },
        }
      );
    }

    // 获取短剧视频源列表
    const sources = await getDuanjuSources();

    if (!sources || sources.length === 0) {
      return NextResponse.json({
        code: 200,
        message: '暂无短剧视频源',
        data: [],
      });
    }

    // 目标源与目标分类：AI 模式用第一个有 AI 分类的源；
    // 真人模式用第一个源的短剧分类（含其子分类兜底）
    let targetSource = sources[0];
    let typeIds: Array<string | number> = [];
    if (mode === 'ai') {
      const aiSource = sources.find((s) => s.aiTypeId);
      if (!aiSource?.aiTypeId) {
        return NextResponse.json({
          code: 200,
          message: '暂无 AI 短剧视频源',
          data: [],
        });
      }
      targetSource = aiSource;
      typeIds = [aiSource.aiTypeId];
      console.log(
        `使用视频源: ${targetSource.name}，AI 分类ID: ${aiSource.aiTypeId}`
      );
    } else {
      // 获取第一个视频源的分类列表，找到短剧分类的ID
      const classUrl = `${targetSource.api}?ac=list`;
      const classResponse = await fetch(classUrl, {
        headers: API_CONFIG.search.headers,
      });

      if (!classResponse.ok) {
        throw new Error('获取分类列表失败');
      }

      const classData = parseJsonLosslessIntegers<CmsClassResponse>(
        await classResponse.text()
      );

      // 找到短剧分类的ID
      let duanjuClass: CmsClassItem | null = null;
      if (classData.class && Array.isArray(classData.class)) {
        duanjuClass = classData.class.find((item) => {
          const typeName = item.type_name?.toLowerCase() || '';
          return (
            typeName.includes('短剧') ||
            typeName.includes('短视频') ||
            typeName.includes('微短剧')
          );
        }) || null;
      }

      if (!duanjuClass) {
        return NextResponse.json({
          code: 200,
          message: '未找到短剧分类',
          data: [],
        });
      }

      const duanjuTypeId = duanjuClass.type_id;
      console.log(`使用视频源: ${targetSource.name}，短剧分类ID: ${duanjuTypeId}`);

      // 短剧分类下的直接子分类；带二级分类的源通常把内容挂在二级分类下，
      // 一级分类为空时依次尝试子分类，取第一个有内容的
      const childTypeIds = (classData.class || [])
        .filter(
          (item) => (item.type_pid ?? 0).toString() === duanjuTypeId.toString()
        )
        .map((item) => item.type_id);

      typeIds = [duanjuClass.type_id, ...childTypeIds];
    }

    let videoList: ApiSearchItem[] | null = null;
    for (const typeId of typeIds) {
      const list = await fetchVideoList(targetSource.api, typeId);
      if (list && list.length > 0) {
        videoList = list;
        break;
      }
    }

    if (!videoList || videoList.length === 0) {
      return NextResponse.json({
        code: 200,
        message: '暂无短剧视频',
        data: [],
      });
    }

    // 处理视频数据
    const videos: SearchResult[] = videoList.map((item: ApiSearchItem) => {
      let episodes: string[] = [];
      let titles: string[] = [];

      // 使用正则表达式从 vod_play_url 提取 m3u8 链接
      if (item.vod_play_url) {
        // 先用 $$$ 分割
        const vod_play_url_array = item.vod_play_url.split('$$$');
        // 分集之间#分割，标题和播放链接 $ 分割
        vod_play_url_array.forEach((url: string) => {
          const matchEpisodes: string[] = [];
          const matchTitles: string[] = [];
          const title_url_array = url.split('#');
          title_url_array.forEach((title_url: string) => {
            const episode_title_url = title_url.split('$');
            if (
              episode_title_url.length === 2 &&
              episode_title_url[1].endsWith('.m3u8')
            ) {
              matchTitles.push(episode_title_url[0]);
              matchEpisodes.push(episode_title_url[1]);
            }
          });
          if (matchEpisodes.length > episodes.length) {
            episodes = matchEpisodes;
            titles = matchTitles;
          }
        });
      }

      return {
        id: item.vod_id.toString(),
        title: item.vod_name.trim().replace(/\s+/g, ' '),
        poster: item.vod_pic,
        episodes,
        episodes_titles: titles,
        source: targetSource.key,
        source_name: targetSource.name,
        class: item.vod_class,
        year: item.vod_year ? item.vod_year.match(/\d{4}/)?.[0] || '' : 'unknown',
        desc: cleanHtmlTags(item.vod_content || ''),
        type_name: item.type_name,
        douban_id: item.vod_douban_id,
      };
    });

    // 过滤掉集数为 0 的结果，并限制返回数量
    const filteredVideos = videos
      .filter((video) => video.episodes.length > 0)
      .slice(0, 20);

    console.log(`返回 ${filteredVideos.length} 个短剧视频`);

    // 保存到内存缓存（按类型分开）
    cachedRecommends[mode] = {
      timestamp: Date.now(),
      data: filteredVideos,
    };

    const cacheTime = 300; // 5 分钟，与服务端内存缓存一致
    return NextResponse.json(
      {
        code: 200,
        message: '获取成功',
        data: filteredVideos,
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    console.error('获取热播短剧推荐失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '获取热播短剧推荐失败',
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
