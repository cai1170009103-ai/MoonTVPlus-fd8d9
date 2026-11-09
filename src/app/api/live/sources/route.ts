/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { canViewAdult, isAdultApiSiteKey } from '@/lib/adult-access';
import { requireFeaturePermission } from '@/lib/permissions';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  console.log(request.url)
  try {
    const authResult = await requireFeaturePermission(request, 'live', '无权限访问电视直播');
    if (authResult instanceof NextResponse) return authResult;
    const config = await getConfig();

    if (!config) {
      return NextResponse.json({ error: '配置未找到' }, { status: 404 });
    }

    // 过滤出所有非 disabled 的直播源；
    // 无成人权限的用户看不到成人直播源（av_ 开头）
    const adultAllowed = await canViewAdult(authResult.username);
    const liveSources = (config.LiveConfig || []).filter(
      (source) =>
        !source.disabled &&
        (adultAllowed || !isAdultApiSiteKey(source.key))
    );

    return NextResponse.json({
      success: true,
      data: liveSources
    });
  } catch (error) {
    console.error('获取直播源失败:', error);
    return NextResponse.json(
      { error: '获取直播源失败' },
      { status: 500 }
    );
  }
}
