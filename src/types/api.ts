export type ComponentInfo = {
  id: string;
  name: string;
  description: string;
  icon: string;
  recommended: boolean;
  sensitive?: boolean;
  requiresEncryption?: boolean;
  files?: number;
  bytes?: number;
  available?: boolean;
  warnings?: number;
};

export type SystemInfo = {
  appVersion: string;
  electronVersion: string;
  platform: string;
  arch: string;
  darkMode: boolean;
  themeSource: 'system' | 'light' | 'dark';
  components: ComponentInfo[];
};

export type ScanResult = {
  components: ComponentInfo[];
  warnings: Array<{ componentId: string; path: string; message: string }>;
  totals: { files: number; bytes: number };
};

export type OperationProgress = {
  type: string;
  phase: string;
  completed?: number;
  total?: number;
  bytes?: number;
  totalBytes?: number;
  message: string;
};

export type BackupResult = {
  destination: string;
  outputBytes: number;
  outputSha256: string;
  manifest: {
    totals: { files: number; bytes: number };
  };
  warnings: unknown[];
};

export type BackupInspection = {
  encrypted: boolean;
  requiresPassword: boolean;
  filePath: string;
  fileBytes: number;
  createdAt?: string;
  appVersion?: string;
  source?: { platform: string; arch: string; hostname: string; release: string };
  compression?: { algorithm: string; level: number };
  components?: Array<{ id: string; name: string; files: number; bytes: number }>;
  totals?: { files: number; bytes: number };
};

export type RestoreResult = {
  restoredFiles: number;
  restoredBytes: number;
  skipped: Array<{ targetPath: string; reason: string }>;
  rollback: null | { destination: string; outputBytes: number; outputSha256: string };
  message?: string;
};

export type CodexBackupApi = {
  getSystemInfo(): Promise<SystemInfo>;
  setThemeSource(themeSource: 'system' | 'light' | 'dark'): Promise<{
    themeSource: 'system' | 'light' | 'dark';
    darkMode: boolean;
  }>;
  scan(request: { componentIds: string[] }): Promise<ScanResult>;
  chooseBackupOutput(): Promise<string | null>;
  createBackup(request: {
    destination: string;
    componentIds: string[];
    encrypt: boolean;
    password?: string;
    compressionLevel: number;
  }): Promise<BackupResult>;
  chooseRestoreInput(): Promise<string | null>;
  inspectBackup(request: { filePath: string; password?: string }): Promise<BackupInspection>;
  restoreBackup(request: {
    filePath: string;
    password?: string;
    componentIds: string[];
    mode: 'merge' | 'overwrite';
    createRollback: boolean;
  }): Promise<RestoreResult>;
  cancelOperation(): Promise<boolean>;
  showItem(targetPath: string): Promise<boolean>;
  controlWindow(action: 'minimize' | 'maximize' | 'close'): void;
  onProgress(callback: (progress: OperationProgress) => void): () => void;
  onWindowState(callback: (state: { maximized: boolean }) => void): () => void;
  onThemeChanged(callback: (state: { themeSource: 'system' | 'light' | 'dark'; darkMode: boolean }) => void): () => void;
};
