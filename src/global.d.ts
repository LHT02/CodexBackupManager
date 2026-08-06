import type { CodexBackupApi } from './types/api';

declare global {
  interface Window {
    codexBackup: CodexBackupApi;
  }
}

export {};
