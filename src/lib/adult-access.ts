/* 成人内容（AV）查看权限
 *
 * 规则：
 * - 站长（owner）与管理员（admin）始终允许；
 * - 普通用户看 users.can_view_adult（默认 0 = 不允许），由管理员在后台开关；
 * - localstorage 单机模式视同站长，始终允许；
 * - 未登录 / 用户不存在 / 被封禁，一律不允许。
 */

import { db } from '@/lib/db';

/** 本站 6 个 AV 源的 key 都是 av_ 开头；成人直播源的 key 也是 av_live */
export function isAdultApiSiteKey(key: string): boolean {
  return key.toLowerCase().startsWith('av_');
}

/**
 * 播放记录 / 收藏的 key 是 `源key+id`。直播记录的源 key 会再加 live_ 前缀，
 * 例如成人直播台的记录 key 是 `live_av_live+live_av_live-0`，
 * 所以要把 live_av_ 也认出来。
 */
export function isAdultRecordKey(key: string): boolean {
  const source = key.split('+')[0].toLowerCase();
  if (isAdultApiSiteKey(source)) return true;
  if (source.startsWith('live_')) {
    return isAdultApiSiteKey(source.slice('live_'.length));
  }
  return false;
}

export async function canViewAdult(
  username?: string | null
): Promise<boolean> {
  if (!username) return false;
  if (username === process.env.USERNAME) return true;

  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') return true;

  try {
    const userInfo = await db.getUserInfoV2(username);
    if (!userInfo || userInfo.banned) return false;
    if (userInfo.role === 'owner' || userInfo.role === 'admin') return true;
    return userInfo.canViewAdult === true;
  } catch (error) {
    console.error('[AdultAccess] Failed to load adult permission:', error);
    return false;
  }
}
