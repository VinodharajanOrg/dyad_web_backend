/**
 * Application Constants
 */

/**
 * List of files and directories to ignore in general file operations
 */
export const IGNORED_PATHS = [
  // Dependencies
  'node_modules',
  'bower_components',
  'jspm_packages',
  
  // Build outputs
  'dist',
  'build',
  '.next',
  '.nuxt',
  'out',
  '.output',
  '.cache',
  '.parcel-cache',
  '.vite',
  
  // Version control
  '.git',
  '.svn',
  '.hg',
  '.gitignore',
  '.gitattributes',
  
  // IDE & Editor
  '.vscode',
  '.idea',
  '.eclipse',
  '.settings',
  '*.swp',
  '*.swo',
  '*~',
  '.DS_Store',
  'Thumbs.db',
  
  // Package manager
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  '.pnpm-store',
  '.yarn',
  
  // Test coverage
  'coverage',
  '.nyc_output',
  
  // Logs
  '*.log',
  'logs',
  'npm-debug.log*',
  'yarn-debug.log*',
  'yarn-error.log*',
  'pnpm-debug.log*',
  
  // Environment
  '.env.local',
  '.env.*.local',
  
  // Temporary
  'tmp',
  'temp',
  '.tmp',
  
  // OS
  'desktop.ini',
  'ehthumbs.db',
] as const;

/**
 * List of files and directories to exclude when exporting apps
 */
export const EXPORT_IGNORE_LIST = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.cache',
  'coverage',
  '.DS_Store',
  '*.log',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock'
] as const;
