/**
 * 统一信封与错误码契约（权威：docs/phase1/consistency-check.md §6 · Spec §5.2）
 * CLI `--json` 输出 = 本信封；RPC 响应 = 本信封。改此文件 = 改契约，须走变更流程。
 */

export const ERROR_CODES = [
  'PORT_CONFLICT',
  'PERMISSION_DENIED',
  'NETWORK_ERROR',
  'CHECKSUM_MISMATCH',
  'DAEMON_NOT_RUNNING',
  'SITE_EXISTS',
  'VERSION_NOT_INSTALLED',
  'CONFIG_INVALID',
  'USAGE_ERROR',
  'SITE_NOT_FOUND',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** retryable 由 daemon 端判定；UI/CLI 不得自行推断（设计契约纪律） */
export const RETRYABLE_BY_CODE: Record<ErrorCode, boolean> = {
  PORT_CONFLICT: true,
  PERMISSION_DENIED: true,
  NETWORK_ERROR: true,
  CHECKSUM_MISMATCH: false,
  DAEMON_NOT_RUNNING: true,
  SITE_EXISTS: false,
  VERSION_NOT_INSTALLED: false,
  CONFIG_INVALID: false,
  USAGE_ERROR: false,
  SITE_NOT_FOUND: false,
};

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  hint: string;
  retryable?: boolean;
}

export interface Envelope<T = Record<string, unknown>> {
  status: 'ok' | 'error';
  data?: T;
  error?: ErrorBody;
}

export function ok<T extends Record<string, unknown>>(data: T): Envelope<T> {
  return { status: 'ok', data };
}

export function fail(
  code: ErrorCode,
  message: string,
  hint: string,
  retryable: boolean = RETRYABLE_BY_CODE[code],
): Envelope<never> {
  return { status: 'error', error: { code, message, hint, retryable } };
}
