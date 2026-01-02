import { db } from '../db';
import { apps } from '../db/schema';
import { eq, ilike, desc, and } from 'drizzle-orm';
import { AppError } from '../middleware/errorHandler';
//import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { TemplateService } from './template_service';
import { logger } from '../utils/logger';
import fs from 'node:fs/promises';


/**
 * App Service - Handles app-related business logic
 * Migrated from src/ipc/handlers/app_handlers.ts
 */
export class AppService {
  private readonly templateService: TemplateService;

  constructor() {
    this.templateService = new TemplateService();
  }

  private getAppsBaseDir(): string {
    return process.env.APPS_BASE_DIR || "./apps";
  }

  /**
   * Get available templates
   */
  async getTemplates() {
    return this.templateService.getTemplates();
  }

  /**
   * Get the full absolute path for an app
   */
  getFullAppPath(appPath: string): string {
    const baseDir = this.getAppsBaseDir();
    return path.isAbsolute(appPath)
      ? appPath
      : path.resolve(process.cwd(), baseDir, appPath);
  }

  async listApps(userId: string) {
    try {
      const limit = Number(process.env.DEFAULT_LIMIT) || 10;
      //add for user id
      return await db
        .select()
        .from(apps)
        .where(eq(apps.user_id, userId))
        .orderBy(desc(apps.createdAt))
        .limit(limit);
    } catch (error: any) {
      throw new AppError(500, `Failed to list apps: ${error.message}`);
    }
  }

  async getApp(appId: string, userId?: string) {
    try {
      if (!userId) throw new Error("userId is required");
      const [app] = await db.select().from(apps)
      .where(and(eq(apps.id, Number.parseInt(appId)), 
      eq(apps.user_id, userId)));

      if (!app) {
        throw new AppError(404, `App not found: ${appId}`);
      }

      return app;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to get app: ${error.message}`);
    }
  }

  async createApp(data: {
    name: string;
    path?: string;
    template?: string;
    installCommand?: string;
    startCommand?: string;
    userId: string;
  }) {
    try {
      // Resolve full app path relative to APPS_BASE_DIR
      const baseDir = this.getAppsBaseDir();
      
      // Generate path from name if not provided
      const appPath = data.path || data.name;
      
      // Remove leading slash if present to treat as relative path
      let relativePath = appPath.startsWith('/') ? appPath.slice(1) : appPath;
      
      // If the path already starts with 'apps/', remove it to avoid duplication
      if (relativePath.startsWith("apps/")) {
        relativePath = relativePath.slice(5); // Remove 'apps/' prefix
      }

      const fullPath = path.isAbsolute(relativePath)
        ? relativePath
        : path.resolve(process.cwd(), baseDir, relativePath);

      logger.info("Creating app", {
        service: "app",
        appName: data.name,
        fullPath,
      });

      // Default to vite-react-shadcn template if not specified
      const template = data.template || "vite-react-shadcn";
      logger.info("Using template", { service: "app", template });

      // Copy template files
      await this.templateService.copyTemplate(template, fullPath);

      // Update package.json with app name if template has one
      if (template === "vite-react-shadcn") {
        await this.templateService.updatePackageJson(fullPath, data.name);
      }

      // Determine default commands based on template
      let installCommand = data.installCommand;
      let startCommand = data.startCommand;

      if (
        !installCommand &&
        !startCommand &&
        template === "vite-react-shadcn"
      ) {
        installCommand = "pnpm install";
        startCommand = "pnpm dev";
      }

      const [app] = await db
        .insert(apps)
        .values({
          user_id: data.userId,
          name: data.name,
          path: fullPath,
          installCommand: installCommand,
          startCommand: startCommand,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return app;
    } catch (error: any) {
      throw new AppError(500, `Failed to create app: ${error.message}`);
    }
  }
  
  async updateApp(appId: number, userId: string, updates: Partial<{
  name: string;
  path: string;
  installCommand: string;
  startCommand: string;
  isFavorite: boolean;
  renameFolder: boolean;
}>) {
  try {
    const [existingApp] = await db
      .select()
      .from(apps)
      .where(
       and(eq(apps.id, appId), eq(apps.user_id, userId)));

      if (!existingApp) {
      throw new AppError(404, `App not found: ${appId}`);
    } 
      const { renameFolder, ...restUpdates } = updates;
      console.log("Existing app data:", existingApp);
      // If renameFolder = true → update name & folder path
      if (renameFolder && restUpdates.name) {
        const oldPath = existingApp.path;

        // get parent folder
        const parentDir = path.dirname(oldPath);
        // build new full path
        const newPath = path.join(parentDir, restUpdates.name);
        try{

        await fs.rename(oldPath, newPath);  
        restUpdates.path = newPath;
        console.log("Rename folder flag:", restUpdates.name, renameFolder);  // update DB path
      } catch (err: any) {
        throw new AppError(
          500,
          `Failed to rename folder from "${oldPath}" to "${newPath}": ${err.message}`
        );
      }
    }

    // --- Update database ---
    const [updatedApp] = await db
      .update(apps)
      .set({
        ...restUpdates,
        updatedAt: new Date(),
      })
      .where(and(eq(apps.id, appId), eq(apps.user_id, userId)))
      .returning();

    return updatedApp;

  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, `Failed to update app: ${error.message}`);
    }
  }

    async deleteApp(appId: number, userId: string) {
    try {
       const result = await db.delete(apps).where(and(eq(apps.id, appId), eq(apps.user_id, userId))).returning();

      if (result.length === 0) {
        throw new AppError(404, `App not found: ${appId}`);
      }

      return { success: true, message: "App deleted successfully" };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to delete app: ${error.message}`);
    }
  }

  async toggleFavorite(appId: string, userId: string) {
    try {
      const app = await this.getApp(appId, userId);

      const [updated] = await db
        .update(apps)
        .set({
          isFavorite: !app.isFavorite,
          updatedAt: new Date(),
        })
        .where(eq(apps.id, Number.parseInt(appId)))
        .returning();
      

      return updated;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to toggle favorite: ${error.message}`);
    }
  }

  async searchApps(name: string, userId: string) {
    try {
      const limit = Number(process.env.DEFAULT_LIMIT) || 10;
      return await db
        .select()
        .from(apps)
        .where(and(ilike(apps.name, `%${name}%`), eq(apps.user_id, userId)))
        .limit(limit);
    } catch (error: any) {
      throw new AppError(500, `Failed to search apps: ${error.message}`);
    }
  }
}
