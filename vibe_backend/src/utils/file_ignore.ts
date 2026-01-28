/**
 * Centralized file and directory ignore patterns
 * Used to exclude files/directories from file listing operations
 */

import { EXPORT_IGNORE_LIST, IGNORED_PATHS } from './constants';

/**
 * Check if a path should be ignored
 * @param name - File or directory name
 * @param isDirectory - Whether the path is a directory
 * @returns true if the path should be ignored
 */
export function shouldIgnorePath(name: string, isDirectory: boolean = false): boolean {
  // Check exact matches
  if (IGNORED_PATHS.includes(name as any)) {
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
/**
 * Check if a file or directory name should be ignored during export
 * @param name - File or directory name
 * @returns true if the file should be ignored during export
 */
export function shouldIgnoreForExport(name: string): boolean {
  // Check exact matches
  if (EXPORT_IGNORE_LIST.includes(name as any)) {
    return true;
  }
  
  // Check pattern matches (e.g., *.log)
  if (name.endsWith('.log')) {
    return true;
  }
  
  return false;
}
