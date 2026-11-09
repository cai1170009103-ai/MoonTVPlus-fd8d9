import { Suspense } from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';

import AvPageClient from '@/components/AvPageClient';
import { parseAuthInfo } from '@/lib/auth';
import { canViewAdult } from '@/lib/adult-access';

// 成人专区：服务端拦截。没有成人权限的用户（包括未登录）
// 连女优名单和头像都看不到，只看到这句提示；
// 光在前端藏导航没用，直接敲 /av 也会被挡在这里。
export default async function AvPage() {
  const cookieStore = await cookies();
  const authInfo = parseAuthInfo(cookieStore.get('auth')?.value);
  const adultAllowed = await canViewAdult(authInfo?.username);

  if (!adultAllowed) {
    return (
      <div className='flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center'>
        <div className='text-5xl'>🔞</div>
        <h1 className='text-xl font-bold'>无权访问成人内容</h1>
        <p className='max-w-sm text-sm text-gray-500 dark:text-gray-400'>
          当前账号未开通成人内容查看权限。
          如需开通，请联系站长在管理后台为你的账号开启。
        </p>
        <Link
          href='/'
          className='rounded-full bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700'
        >
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <Suspense>
      <AvPageClient />
    </Suspense>
  );
}
