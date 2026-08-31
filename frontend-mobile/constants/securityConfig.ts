export const DEFAULT_LOCK_TIMEOUT_MINUTES = 2;
export const MAX_LOCK_TIMEOUT_MINUTES = 5;
export const HARD_LOCK_TIMEOUT_MINUTES = 5;
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LENGTH = 4;
export const INACTIVITY_WIPE_DAYS = 30;
export const AUDIT_LOG_RETENTION_DAYS = 7;

export const SECURE_STORE_KEYS = {
  DEK: 'idel_dek',
  FEK: 'idel_fek',
  ACCESS_TOKEN: 'idel_access_token',
  REFRESH_TOKEN: 'idel_refresh_token',
  PIN_HASH: 'idel_pin_hash',
  PIN_SALT: 'idel_pin_salt',
  PIN_ATTEMPTS: 'idel_pin_attempts',
  LAST_ACTIVITY: 'idel_last_activity',
  BIOMETRIC_ENABLED: 'idel_biometric_enabled',
  DEVICE_ID: 'idel_device_id',
} as const;
