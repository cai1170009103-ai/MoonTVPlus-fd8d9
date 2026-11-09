/* eslint-disable @typescript-eslint/no-explicit-any */

import { HttpsProxyAgent } from 'https-proxy-agent';
import nodeFetch from 'node-fetch';
import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

function isCloudflareEnvironment(): boolean {
  return (
    process.env.CF_PAGES === '1' || process.env.BUILD_TARGET === 'cloudflare'
  );
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function applyBangumiImageBaseUrl(
  imageUrl: string,
  imageBaseUrl?: string
): string {
  const normalizedBaseUrl = normalizeBaseUrl(imageBaseUrl || '');
  if (!normalizedBaseUrl) {
    return imageUrl;
  }

  if (imageUrl.startsWith(`${normalizedBaseUrl}/`)) {
    return imageUrl;
  }

  return `${normalizedBaseUrl}/${imageUrl}`;
}

function isBangumiImageUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname === 'lain.bgm.tv' ||
      hostname === 'r.bgm.tv' ||
      hostname === 'bangumi.lol' ||
      hostname.endsWith('.bgm.tv') ||
      hostname.endsWith('.bangumi.tv') ||
      hostname.endsWith('.bangumi.lol')
    );
  } catch {
    return false;
  }
}

async function fetchImage(
  imageUrl: string,
  options?: { source?: string }
): Promise<Response> {
  const isBangumiImage =
    options?.source === 'bangumi' || isBangumiImageUrl(imageUrl);
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    Referer: isBangumiImage ? 'https://bgm.tv/' : 'https://movie.douban.com/',
  };

  const config = isBangumiImage ? await getConfig() : null;
  const targetUrl = isBangumiImage
    ? applyBangumiImageBaseUrl(imageUrl, config?.SiteConfig.BangumiImageBaseUrl)
    : imageUrl;

  if (!isBangumiImage || isCloudflareEnvironment()) {
    return fetch(targetUrl, { headers, signal: AbortSignal.timeout(15000) });
  }

  const proxy = config?.SiteConfig.BangumiProxy?.trim();
  const fetchOptions: any = {
    headers,
    signal: AbortSignal.timeout(proxy ? 30000 : 15000),
  };

  if (proxy) {
    fetchOptions.agent = new HttpsProxyAgent(proxy, {
      timeout: 30000,
      keepAlive: false,
    });
  }

  return nodeFetch(targetUrl, fetchOptions) as unknown as Promise<Response>;
}

// OrionTV 兼容接口
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');
  const source = searchParams.get('source') || undefined;
  // 可选裁剪宽度（卡片海报传 360）：服务端用 sharp 缩到卡片尺寸再返回，
  // 手机刷列表时不用下载几百 KB 的原图。超过 720 按 720 算。
  const targetWidth = (() => {
    const w = Number(searchParams.get('w'));
    if (!Number.isFinite(w) || w <= 0) return 0;
    return Math.min(720, Math.floor(w));
  })();

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
  }

  // 创建响应头
  const makeHeaders = (contentType: string | null) => {
    const headers = new Headers();
    if (contentType) {
      headers.set('Content-Type', contentType);
    }

    // 设置缓存头（可选）
    headers.set('Cache-Control', 'public, max-age=15720000, s-maxage=15720000'); // 缓存半年
    headers.set('CDN-Cache-Control', 'public, s-maxage=15720000');
    headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=15720000');
    headers.set('Netlify-Vary', 'query');
    return headers;
  };

  try {
    const imageResponse = await fetchImage(imageUrl, { source });

    if (!imageResponse.ok || !imageResponse.body) {
      // 代理取不到图（如源站防盗链）时 302 回原地址，让浏览器直连再试一次，
      // 而不是直接返回一张裂图。
      return NextResponse.redirect(imageUrl, 302);
    }

    const contentType = imageResponse.headers.get('content-type');

    // 需要裁剪且是图片时，用 sharp 缩图；任何一步失败都回退到原图直出。
    if (
      targetWidth > 0 &&
      contentType &&
      contentType.startsWith('image/') &&
      !contentType.includes('svg')
    ) {
      try {
        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        const sharp = (await import('sharp')).default;
        const resized = await sharp(buffer)
          .resize({ width: targetWidth, withoutEnlargement: true })
          .toBuffer();
        return new Response(resized as unknown as BodyInit, {
          status: 200,
          headers: makeHeaders(contentType),
        });
      } catch (resizeError) {
        console.warn('图片裁剪失败，回退原图:', resizeError);
        // 下面重新取一次原图流返回（arrayBuffer 已消费，不能复用旧 body）
        const retryResponse = await fetchImage(imageUrl, { source });
        if (!retryResponse.ok || !retryResponse.body) {
          return NextResponse.redirect(imageUrl, 302);
        }
        return new Response(retryResponse.body as unknown as BodyInit, {
          status: 200,
          headers: makeHeaders(
            retryResponse.headers.get('content-type') || contentType
          ),
        });
      }
    }

    // 直接返回图片流
    return new Response(imageResponse.body as unknown as BodyInit, {
      status: 200,
      headers: makeHeaders(contentType),
    });
  } catch (error) {
    console.error('图片代理请求失败:', error);
    // 代理本身异常时同样回原地址，让浏览器直连兜底。
    try {
      return NextResponse.redirect(imageUrl, 302);
    } catch {
      return NextResponse.json(
        { error: 'Error fetching image' },
        { status: 500 }
      );
    }
  }
}
