import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * Codebase Service - Extract code context for AI
 * Migrated from src/utils/codebase.ts
 */

export interface CodebaseFile {
  path: string;
  content: string;
  size: number;
}

export interface CodebaseContext {
  formattedOutput: string; // Text format for AI
  files: CodebaseFile[];   // Structured data
  totalFiles: number;
  totalSize: number;
}

export interface ContextConfig {
  contextPaths?: Array<{ globPath: string }>;
  smartContextAutoIncludes?: string[];
  excludePaths?: Array<{ globPath: string }>;
  selectedComponent?: {
    relativePath: string;
    label: string;
  } | null;
  // Smart Context options
  enableSmartContext?: boolean;
  smartContextMode?: 'balanced' | 'deep';
  prompt?: string; // User's current prompt for relevance scoring
  maxFiles?: number; // Limit number of files (default 50 for balanced, 100 for deep)
}

export class CodebaseService {
  private readonly fileCache = new Map<string, { content: string; mtime: number }>();

  // Files that should always be included (high relevance)
  private readonly AUTO_INCLUDE_PATTERNS = [
    'package.json',
    'tsconfig.json',
    'vite.config.*',
    'tailwind.config.*',
    'src/App.tsx',
    'src/main.tsx',
    'src/index.tsx',
    'src/pages/Index.tsx',
    'AI_RULES.md',
  ];

  // Files/directories to always exclude (low relevance, high token cost)
  private readonly AUTO_EXCLUDE_PATTERNS = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.bundle.js',
    '**/*.map',
    '**/package-lock.json',
    '**/pnpm-lock.yaml',
    '**/yarn.lock',
  ];

  /**
   * Extract codebase context for a given app
   */
  async extractContext(
    appPath: string,
    config: ContextConfig = {}
  ): Promise<CodebaseContext> {
    try {
      // If specific component selected, only include that file
      if (config.selectedComponent) {
        const filePath = path.join(appPath, config.selectedComponent.relativePath);
        const content = await this.readFileWithCache(filePath);
        
        return {
          formattedOutput: this.formatCodebase([{
            path: config.selectedComponent.relativePath,
            content,
            size: content.length,
          }]),
          files: [{
            path: config.selectedComponent.relativePath,
            content,
            size: content.length,
          }],
          totalFiles: 1,
          totalSize: content.length,
        };
      }

      // Get files from glob patterns
      const contextPaths = config.contextPaths || [
        { globPath: 'src/**/*.{ts,tsx,js,jsx}' },
        { globPath: 'package.json' },
      ];

      const files: CodebaseFile[] = [];
      let totalSize = 0;

      // Build exclude patterns
      const excludePatterns = this.AUTO_EXCLUDE_PATTERNS.slice();
      if (config.excludePaths) {
        excludePatterns.push(...config.excludePaths.map(p => p.globPath));
      }

      for (const { globPath } of contextPaths) {
        const pattern = path.join(appPath, globPath);
        const matches = await glob(pattern, {
          ignore: excludePatterns,
          nodir: true,
        });

        for (const filePath of matches) {
          try {
            const content = await this.readFileWithCache(filePath);
            const relativePath = path.relative(appPath, filePath);
            
            files.push({
              path: relativePath,
              content,
              size: content.length,
            });
            
            totalSize += content.length;
          } catch (error: any) {
            logger.warn('Failed to read file', { 
              service: 'codebase', 
              filePath, 
              error: error?.message || String(error) 
            });
          }
        }
      }

      // Add smart context files if specified
      if (config.smartContextAutoIncludes) {
        for (const relativePath of config.smartContextAutoIncludes) {
          const filePath = path.join(appPath, relativePath);
          
          if (!files.some(f => f.path === relativePath)) {
            try {
              const content = await this.readFileWithCache(filePath);
              files.push({
                path: relativePath,
                content,
                size: content.length,
              });
              totalSize += content.length;
            } catch (error: any) {
              logger.warn('Failed to read smart context file', { 
                service: 'codebase', 
                filePath, 
                error: error?.message || String(error) 
              });
            }
          }
        }
      }

      // Apply Smart Context filtering if enabled
      let filteredFiles = files;
      if (config.enableSmartContext && files.length > 0) {
        filteredFiles = await this.applySmartContextFiltering(
          files,
          appPath,
          config
        );
        
        logger.info('Smart Context filtering applied', {
          service: 'codebase',
          mode: config.smartContextMode,
          originalFiles: files.length,
          filteredFiles: filteredFiles.length,
          reductionPercent: Math.round((1 - filteredFiles.length / files.length) * 100)
        });
      }

      // Recalculate total size after filtering
      const finalTotalSize = filteredFiles.reduce((sum, f) => sum + f.size, 0);

      return {
        formattedOutput: this.formatCodebase(filteredFiles),
        files: filteredFiles,
        totalFiles: filteredFiles.length,
        totalSize: finalTotalSize,
      };
    } catch (error: any) {
      throw new AppError(500, `Failed to extract codebase context: ${error?.message || String(error)}`);
    }
  }

  /**
   * Read file with caching to avoid redundant disk I/O
   */
  private async readFileWithCache(filePath: string): Promise<string> {
    try {
      const stats = fs.statSync(filePath);
      const cached = this.fileCache.get(filePath);

      if (cached && cached.mtime === stats.mtimeMs) {
        return cached.content;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      this.fileCache.set(filePath, {
        content,
        mtime: stats.mtimeMs,
      });

      return content;
    } catch (error: any) {
      throw new Error(`Failed to read file ${filePath}: ${error?.message || String(error)}`);
    }
  }

  /**
   * Format codebase files for AI context
   */
  private formatCodebase(files: CodebaseFile[]): string {
    const formatted = ['<codebase>', ''];

    for (const file of files) {
      const extension = path.extname(file.path).slice(1);
      const language = this.getLanguageFromExtension(extension);
      
      formatted.push(`FILE: ${file.path}`);
      formatted.push('```' + language);
      formatted.push(file.content);
      formatted.push('```');
      formatted.push('');
    }

    formatted.push('</codebase>');
    return formatted.join('\n');
  }

  /**
   * Get syntax highlighting language from file extension
   */
  private getLanguageFromExtension(ext: string): string {
    const map: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'json': 'json',
      'css': 'css',
      'html': 'html',
      'md': 'markdown',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'rb': 'ruby',
      'php': 'php',
    };
    return map[ext] || ext;
  }

  /**
   * Clear file cache
   */
  clearCache() {
    this.fileCache.clear();
  }

  /**
   * Apply Smart Context filtering to reduce files based on relevance
   * Uses heuristics: file modification time, keyword matching, size limits
   */
  private async applySmartContextFiltering(
    files: CodebaseFile[],
    appPath: string,
    config: ContextConfig
  ): Promise<CodebaseFile[]> {
    const maxFiles = config.maxFiles || (config.smartContextMode === 'deep' ? 100 : 50);
    const prompt = config.prompt?.toLowerCase() || '';

    // Score each file based on relevance
    interface ScoredFile extends CodebaseFile {
      score: number;
    }

    const scoredFiles: ScoredFile[] = [];

    for (const file of files) {
      let score = 0;

      // 1. Auto-include patterns get highest priority (score +1000)
      const isAutoInclude = this.AUTO_INCLUDE_PATTERNS.some(pattern => {
        const globPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
        const regex = new RegExp(globPattern);
        return regex.test(file.path);
      });
      if (isAutoInclude) {
        score += 1000;
      }

      // 2. Files mentioned in smartContextAutoIncludes (+800)
      if (config.smartContextAutoIncludes) {
        const isExplicitInclude = config.smartContextAutoIncludes.some(pattern => {
          const globPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
          const regex = new RegExp(globPattern);
          return regex.test(file.path);
        });
        if (isExplicitInclude) {
          score += 800;
        }
      }

      // 3. Recently modified files (+100 to +300 based on recency)
      try {
        const fullPath = path.join(appPath, file.path);
        const stats = fs.statSync(fullPath);
        const ageInHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
        
        if (ageInHours < 1) score += 300;        // Modified in last hour
        else if (ageInHours < 24) score += 200;  // Modified today
        else if (ageInHours < 168) score += 100; // Modified this week
      } catch {
        // File stat failed, skip time-based scoring
      }

      // 4. Keyword matching in filename and content (+50 per match, max +200)
      if (prompt) {
        const keywords = prompt.split(/\s+/).filter(k => k.length > 3);
        let keywordMatches = 0;

        for (const keyword of keywords) {
          // Match in filename
          if (file.path.toLowerCase().includes(keyword)) {
            keywordMatches++;
          }
          // Match in content (case-insensitive, limit to first 5000 chars for performance)
          const contentSample = file.content.substring(0, 5000).toLowerCase();
          if (contentSample.includes(keyword)) {
            keywordMatches++;
          }
        }

        score += Math.min(keywordMatches * 50, 200);
      }

      // 5. File type priority (+50 for common important files)
      const fileType = path.extname(file.path);
      if (['.tsx', '.ts', '.jsx', '.js'].includes(fileType)) {
        score += 50;
      }

      // 6. Directory priority (+30 for src/, components/, pages/)
      if (file.path.includes('src/pages/') || file.path.includes('src/components/')) {
        score += 30;
      }

      // 7. Penalty for very large files (-100 for files > 10KB)
      if (file.size > 10000) {
        score -= 100;
      }

      scoredFiles.push({ ...file, score });
    }

    // Sort by score (descending) and take top N files
    scoredFiles.sort((a, b) => b.score - a.score);
    const topFiles = scoredFiles.slice(0, maxFiles);

    logger.debug('Smart Context file scoring', {
      service: 'codebase',
      totalFiles: files.length,
      selectedFiles: topFiles.length,
      topScores: topFiles.slice(0, 5).map(f => ({ path: f.path, score: f.score })),
    });

    // Remove score property before returning
    return topFiles.map(({ score, ...file }) => file);
  }
}
