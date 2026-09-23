export const ACCOUNT_BACKUP_STATE_KEY = 'account_backup_state';

export type AccountBackupSection =
  | 'wall'
  | 'photos'
  | 'videos'
  | 'docs'
  | 'notes'
  | 'gifts'
  | 'subscriptions'
  | 'friends'
  | 'profile';

export type AccountBackupFormat = 'json' | 'zip';

export interface AccountBackupOptions {
  sections: AccountBackupSection[];
  format: AccountBackupFormat;
  includeMedia: boolean;
}

export interface AccountBackupState {
  status: 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';
  progress: number;
  currentSection?: AccountBackupSection;
  completedSections: AccountBackupSection[];
  errors: Partial<Record<AccountBackupSection, string>>;
  startedAt?: number;
  completedAt?: number;
  filename?: string;
  error?: string;
}

export const EMPTY_ACCOUNT_BACKUP_STATE: AccountBackupState = {
  status: 'idle',
  progress: 0,
  completedSections: [],
  errors: {},
};
