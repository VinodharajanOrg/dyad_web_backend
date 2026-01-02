import { requireAuth } from "../middleware/auth.middleware";
import { Router, Request, Response } from 'express';
import { ChatService } from '../services/chat_service';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validateBody';
import { appIdField, chatIdField, createChatSchema, createMessageSchema, idField, messageIdField, titleChatsSchema } from '../db/validateSchema';

const router = Router();
const chatService = new ChatService();

/**
 * Chat Routes - REST API for chat and message management
 * Replaces IPC handlers from src/ipc/handlers/chat_handlers.ts
 */

/**
 * @swagger
 * /api/chats:
 *   get:
 *     tags: [Chats]
 *     summary: List chats for an app
 *     description: Retrieve all chats associated with a specific app
 *     parameters:
 *       - in: query
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *         description: App ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of chats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Chat'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get(
  "/",
  requireAuth,
  validate(appIdField, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { appId } = req.query;
    const userId = (req as any).user?.id;

    const chats = await chatService.listChats(appId as string, userId);
    res.json({ data: chats });
  })
);
/**
 * @swagger
 * /api/chats/search:
 *   get:
 *     tags: [Chats]
 *     summary: Get chats/messages/content by title
 *     parameters:
 *       - in: query
 *         name: title
 *         required: true
 *         description: Title or partial title of the chat
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of matching chats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       chatId:
 *                         type: integer
 *                       appId:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       initial_commit_hash:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 */
router.get(
  "/search",
  requireAuth,
  validate(titleChatsSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { title } = req.query;
    const userId = (req as any).user?.id;
    if (!title || String(title).trim().length === 0) {
      return res.status(400).json({ error: "Query param 'title' is required" });
    }

    const chats = await chatService.searchChats(String(title), userId);
    res.json({ data: chats });
  })
);

/**
 * @swagger
 * /api/chats/{chatId}/rename:
 *   put:
 *     tags: [Chats]
 *     summary: Rename a chat by chatId
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         description: ID of the chat to rename
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: New chat title
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chat renamed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     chatId:
 *                       type: integer
 *                     title:
 *                       type: string
 *                     appId:
 *                       type: integer
 *                     initial_commit_hash:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 */
router.put(
  '/:chatId/rename',
  requireAuth,
  validate(chatIdField, 'params'),
  validate(titleChatsSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { title } = req.body;
    const userId = (req as any).user?.id;
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: "New title cannot be empty" });
    }

    const chat = await chatService.renameChat(Number(chatId), title, userId);
    res.json({ data: chat });
  })
);

/**
 * @swagger
 * /api/chats/{id}:
 *   get:
 *     tags: [Chats]
 *     summary: Get chat by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Chat ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chat details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Chat'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  "/:id",
  requireAuth,
  validate(idField, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const chat = await chatService.getChat(req.params.id, userId);
    res.json({ data: chat });
  })
);

/**
 * @swagger
 * /api/chats:
 *   post:
 *     tags: [Chats]
 *     summary: Create new chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appId
 *             properties:
 *               appId:
 *                 type: string
 *                 description: App ID
 *               title:
 *                 type: string
 *                 description: Chat title
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Chat created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Chat'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post(
  "/",
  requireAuth,
  validate(createChatSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { appId, title } = req.body;
    const userId = (req as any).user?.id;

    const chat = await chatService.createChat(appId, title, userId);
    res.status(201).json({ data: chat });
  })
);

/**
 * @swagger
 * /api/chats/{id}:
 *   delete:
 *     tags: [Chats]
 *     summary: Delete chat
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Chat ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chat deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.delete(
  "/:id",
  requireAuth,
   validate(idField, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const result = await chatService.deleteChat(req.params.id, userId);
    res.json(result);
  })
);

/**
 * @swagger
 * /api/chats/{id}/messages:
 *   get:
 *     tags: [Chats]
 *     summary: Get messages for a chat
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Chat ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 */
router.get(
  "/:id/messages",
  requireAuth,
  validate(idField, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const messages = await chatService.getMessages(req.params.id, userId);
    res.json({ data: messages });
  })
);

/**
 * @swagger
 * /api/chats/{id}/messages:
 *   post:
 *     tags: [Chats]
 *     summary: Create new message
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Chat ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *               - content
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, assistant]
 *               content:
 *                 type: string
 *               model:
 *                 type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Message created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Message'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post(
  "/:id/messages",
  requireAuth,
   validate(idField, 'params'), validate(createMessageSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { role, content, model } = req.body;

    if (!role || !content) {
      return res.status(400).json({ error: "role and content are required" });
    }

    const message = await chatService.createMessage({
      chatId: req.params.id,
      role,
      content,
      model,
      user_id: userId,
    });

    res.status(201).json({ data: message });
  })
);

/**
 * @swagger
 * /api/chats/{chatId}/messages/{messageId}:
 *   put:
 *     tags: [Chats]
 *     summary: Update message
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Chat ID
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               model:
 *                 type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Message updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Message'
 */
router.put(
  "/:chatId/messages/:messageId",
  requireAuth,
  validate(chatIdField.merge(messageIdField), 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const message = await chatService.updateMessage(req.params.messageId,userId,req.body);
    res.json({ data: message });
  })
);

export default router;
