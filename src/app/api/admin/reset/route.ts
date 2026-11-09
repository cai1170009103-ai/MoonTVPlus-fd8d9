/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db } from '@/lib/db';
import { resetConfig } from '@/lib/config';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const username = authInfo.username;

  if (username !== process.env.USERNAME) {
    // 环境变量比对失败时，以数据库中的 owner 角色为准（数据库建的站长账号 role 为 owner）
    const ownerInfo = await db.getUserInfoV2(username);
    if (!ownerInfo || ownerInfo.role !== 'owner' || ownerInfo.banned) {
      return NextResponse.json({ error: '仅支持站长重置配置' }, { status: 401 });
    }
  }

  try {
    await resetConfig();

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store', // 管理员配置不缓存
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: '重置管理员配置失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
