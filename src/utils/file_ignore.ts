/**
 * Centralized file and directory ignore patterns
 * Used to exclude files/directories from file listing operations
 */

/**
 * List of files and directories to ignore
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
];


/**
 * Check if a path should be ignored
 * @param name - File or directory name
 * @param isDirectory - Whether the path is a directory
 * @returns true if the path should be ignored
 */
export function shouldIgnorePath(name: string, isDirectory: boolean = false): boolean {
  // Check exact matches
  if (IGNORED_PATHS.includes(name)) {
    return true;
  }

  // Check wildcard patterns
  for (const pattern of IGNORED_PATHS) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(name)) {
        return true;
      }
    }
  }
  
  return false;
}