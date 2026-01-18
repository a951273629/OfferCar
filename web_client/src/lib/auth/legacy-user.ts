import type { User } from '@/types';
import { createBill } from '@/lib/db/queries/billing';
import { findUserByReferralCode, updateUserReferrer } from '@/lib/db/queries/referral';
import { ensureUserProfile, findUserById, updateUserBalance } from '@/lib/db/queries/user';

export interface EnsureLegacyUserParams {
  authUserId: string;
  email: string;
  referralCode?: string;
}

export interface EnsureLegacyUserResult {
  legacyUser: User;
  isNewUser: boolean;
}

/**
 * 发放新用户注册奖励（无条件100点）
 */
async function grantNewUserReward(userId: string): Promise<number> {
  const newBalance = await updateUserBalance(userId, 100);

  await createBill(
    userId,
    'recharge',
    'recharge',
    100,
    0,
    newBalance,
    '注册奖励',
    undefined
  );

  return newBalance;
}

/**
 * 处理邀请码逻辑（邀请人获得100点推荐奖励）
 */
async function processReferralCode(params: {
  userId: string;
  email: string;
  referralCode: string;
}): Promise<void> {
  const trimmedCode = String(params.referralCode).trim();
  if (!trimmedCode) {
    return;
  }

  // 防止用户填写自己的邮箱作为邀请码
  if (trimmedCode.toLowerCase() === params.email.toLowerCase()) {
    return;
  }

  try {
    // 查找推荐人
    const referrer = await findUserByReferralCode(trimmedCode);
    if (!referrer) {
      console.log(`[LegacyUser] 邀请码无效: ${trimmedCode}`);
      return;
    }

    if (referrer.id === params.userId) {
      console.log('[LegacyUser] 检测到自引用邀请码，跳过处理');
      return;
    }

    // 绑定推荐关系
    await updateUserReferrer(params.userId, referrer.id);

    // 邀请人获得推荐奖励 100 点
    const referrerBalance = await updateUserBalance(referrer.id, 100);

    // 创建账单流水记录 - 推荐人
    await createBill(
      referrer.id,
      'recharge',
      'recharge',
      100,
      0,
      referrerBalance,
      `推荐奖励 - 成功推荐新用户 (${params.email})`,
      undefined
    );

    console.log(
      `[LegacyUser] 推荐关系已绑定: 新用户 ${params.userId} <- 推荐人 ${referrer.id}`
    );
  } catch (error) {
    console.error('[LegacyUser] 处理邀请码失败:', error);
    // 邀请码处理失败不影响注册/登录主流程
  }
}

/**
 * 确保旧 users 体系存在对应用户记录：
 * - 迁移后：确保 user_profile 存在（以 better-auth.user.id 为主键）
 * - 若 user_profile 不存在：创建 profile、发放注册奖励、处理邀请码
 * - 若存在：直接返回（不重复发奖/不重复绑定邀请码）
 */
export async function ensureLegacyUserForEmail(
  params: EnsureLegacyUserParams
): Promise<EnsureLegacyUserResult> {
  const authUserId = String(params.authUserId).trim();
  if (!authUserId) {
    throw new Error('authUserId 不能为空');
  }

  const email = String(params.email).trim();
  if (!email) {
    throw new Error('email 不能为空');
  }

  const existed = await findUserById(authUserId);
  if (existed) {
    // 注意：这里无法区分“user 存在但 profile 缺失”的边界情况，仍兜底 ensure 一次
    await ensureUserProfile({ authUserId, referralCode: email });
    const refreshed = await findUserById(authUserId);
    if (!refreshed) {
      throw new Error('用户查询失败');
    }
    return { legacyUser: refreshed, isNewUser: false };
  }

  // 首次登录：创建 user_profile（better-auth.user 已由 auth 体系创建）
  await ensureUserProfile({ authUserId, referralCode: email });
  const created = await findUserById(authUserId);
  if (!created) {
    throw new Error('用户初始化失败');
  }

  // 1) 无条件发放新用户注册奖励（100点）
  await grantNewUserReward(created.id);

  // 2) 处理邀请码（如果有）
  const referralCode = params.referralCode;
  if (referralCode && typeof referralCode === 'string') {
    await processReferralCode({
      userId: created.id,
      email: created.email,
      referralCode,
    });
  }

  return { legacyUser: created, isNewUser: true };
}


