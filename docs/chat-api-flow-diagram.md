# Backend Flow: User Chat Message to AI Response & File Management

This diagram shows the **backend (main process)** flow from when a user writes a chat message through AI response processing and file management operations.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FRONTEND → BACKEND ENTRY POINT                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─> IPC Request: "chat:stream"
│   Parameters:
│   - prompt: string (user message)
│   - chatId: number
│   - selectedComponent: ComponentSelection | null
│   - attachments: FileAttachment[]
│   - redo: boolean
└────────────────────────────────────────────────────────────────────────────→

┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND MAIN PROCESS                                │
│                    (src/ipc/handlers/chat_stream_handlers.ts)                │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
STEP 1: IPC HANDLER REGISTRATION & REQUEST RECEIPT
═══════════════════════════════════════════════════════════════════════════════

📍 File: src/ipc/handlers/chat_stream_handlers.ts
📍 Function: registerChatStreamHandlers()

ipcMain.handle("chat:stream", async (event, req: ChatStreamParams) => {
  
  1.1 CREATE ABORT CONTROLLER
      └─> new AbortController()
          - Allows cancellation of long-running AI requests
          - Store in activeStreams Map keyed by chatId
          - User can cancel via "chat:cancel" IPC call

═══════════════════════════════════════════════════════════════════════════════
STEP 2: DATABASE - LOAD EXISTING CHAT & APP DATA
═══════════════════════════════════════════════════════════════════════════════

📍 Database: chats table (SQLite via Drizzle ORM)

  2.1 QUERY CHAT DATA
      └─> db.query.chats.findFirst({ where: eq(chats.id, req.chatId) })
          WITH:
          - messages: All previous messages ordered by createdAt ASC
          - app: App metadata (id, name, path, chatContext)
      
  2.2 HANDLE REDO OPTION
      └─> If req.redo === true:
          - Delete last 2 messages (user message + AI response)
          - Allows user to regenerate AI response
          - Use: db.delete(messages).where(...)

═══════════════════════════════════════════════════════════════════════════════
STEP 3: PROCESS FILE ATTACHMENTS
═══════════════════════════════════════════════════════════════════════════════

📍 File: src/ipc/utils/file_uploads_state.ts

  3.1 HANDLE UPLOAD-TO-CODEBASE FILES
      └─> For each attachment with type="upload-to-codebase":
          - Decode base64 data
          - Extract file name and content
          - Write to app directory: path.join(appPath, fileName)
          - Store in FileUploadsState for cleanup later
          - Mark files as "extra files" (not in git initially)
      
  3.2 HANDLE CHAT-CONTEXT FILES
      └─> For attachments with type="chat-context":
          - Keep in memory for AI context only
          - Don't write to disk
          - Prepare as ModelMessage with content/images
      
  3.3 PROCESS TEXT ATTACHMENTS
      └─> If message contains {file:path/to/file.txt}:
          - Replace placeholder with actual file content
          - Read from app directory
          - Inline in user message
      
  3.4 PROCESS IMAGE ATTACHMENTS
      └─> Convert to ImagePart[] for multimodal AI:
          {
            type: "image",
            image: "data:image/png;base64,..." // base64 data URI
          }

═══════════════════════════════════════════════════════════════════════════════
STEP 4: INSERT USER MESSAGE TO DATABASE
═══════════════════════════════════════════════════════════════════════════════

📍 Database: messages table

  4.1 INSERT USER MESSAGE
      └─> db.insert(messages).values({
            chatId: req.chatId,
            role: "user",
            content: req.prompt, // with attachments processed
            createdAt: new Date()
          }).returning()
      
  4.2 FETCH UPDATED CHAT
      └─> Re-query chat with all messages including new one
          - Ensures consistent state
          - Used for streaming context

═══════════════════════════════════════════════════════════════════════════════
STEP 5: SEND INITIAL LOADING STATE TO FRONTEND
═══════════════════════════════════════════════════════════════════════════════

📍 IPC Event: "chat:response:chunk"

  5.1 EMIT FIRST CHUNK
      └─> safeSend(event.sender, "chat:response:chunk", {
            chatId: req.chatId,
            messages: updatedChat.messages // includes user message
          })
          
          Purpose: Show user message immediately + loading spinner for AI

═══════════════════════════════════════════════════════════════════════════════
STEP 6: AI MODEL CONFIGURATION
═══════════════════════════════════════════════════════════════════════════════

📍 File: src/ipc/utils/get_model_client.ts

  6.1 READ USER SETTINGS
      └─> readSettings()
          - selectedModel: { name, id, providerId }
          - API keys per provider
          - Chat mode: "auto-code" | "agent" | "ask" | "custom"
          - Smart context enabled
          - Turbo edits v2 enabled
      
  6.2 DETERMINE AI PROVIDER
      └─> Based on settings.selectedModel.providerId:
          ┌─────────────────────────────────────────────────────────┐
          │ Provider      │ Module                                   │
          ├───────────────┼──────────────────────────────────────────┤
          │ openai        │ @ai-sdk/openai                          │
          │ anthropic     │ @ai-sdk/anthropic                       │
          │ vertex        │ @ai-sdk/google-vertex                   │
          │ google        │ @ai-sdk/google                          │
          │ azure         │ @ai-sdk/azure                           │
          │ bedrock       │ @ai-sdk/amazon-bedrock                  │
          │ xai           │ @ai-sdk/xai                             │
          │ openrouter    │ @openrouter/ai-sdk-provider             │
          │ ollama        │ @ai-sdk/openai-compatible               │
          │ lmstudio      │ @ai-sdk/openai-compatible               │
          │ dyad-engine   │ @ai-sdk/openai-compatible (proxy)       │
          └─────────────────────────────────────────────────────────┘
      
  6.3 CREATE MODEL CLIENT
      └─> const modelClient = provider(modelId, {
            apiKey: settings.apiKeys[providerId],
            baseURL: customEndpoint || defaultEndpoint,
            // ... other provider-specific options
          })
      
  6.4 CHECK FEATURE FLAGS
      └─> isEngineEnabled: dyad Engine proxy for context optimization
          isSmartContextEnabled: Auto-include related files in context

═══════════════════════════════════════════════════════════════════════════════
STEP 7: EXTRACT CODEBASE CONTEXT
═══════════════════════════════════════════════════════════════════════════════

📍 File: src/utils/codebase.ts

  7.1 READ CHAT CONTEXT CONFIGURATION
      └─> From app.chatContext:
          {
            contextPaths: [
              { globPath: "src/**/*.ts" },
              { globPath: "package.json" }
            ],
            smartContextAutoIncludes: string[]
          }
      
  7.2 APPLY COMPONENT SELECTION FILTER
      └─> If req.selectedComponent:
          - Override context to only this file
          - Used when editing specific component
      
  7.3 SMART CONTEXT ANALYSIS (if enabled)
      └─> Parse chat messages for file references:
          - Extract file paths mentioned in conversation
          - Auto-include referenced files in context
          - Reduces manual context management
      
  7.4 READ FILES FROM DISK
      └─> For each glob pattern:
          - Expand to actual file paths using glob()
          - Read file content: readFileWithCache(filePath)
          - Cache to avoid redundant disk I/O
          - Skip binary files, node_modules, .git
      
  7.5 FORMAT CODEBASE FOR AI
      └─> Output format:
          ```
          <codebase>
          
          FILE: src/main.ts
          ```typescript
          [file content here]
          ```
          
          FILE: package.json
          ```json
          [file content here]
          ```
          
          </codebase>
          ```
      
  7.6 RETURN STRUCTURED DATA
      └─> {
            formattedOutput: string, // Codebase text for AI
            files: CodebaseFile[]    // Structured for Engine
          }

═══════════════════════════════════════════════════════════════════════════════
STEP 8: PREPARE AI MESSAGES
═══════════════════════════════════════════════════════════════════════════════

📍 File: src/prompts/system_prompt.ts

  8.1 CONSTRUCT SYSTEM PROMPT
      └─> constructSystemPrompt({
            chatMode: settings.selectedChatMode,
            aiRules: readAiRules(appPath), // from .ai-rules file
            enableTurboEditsV2: settings.turboEditsV2Enabled
          })
          
          Components:
          - Base instructions (how to write code, use dyad tags)
          - Chat mode specific rules:
            • auto-code: Generate code immediately
            • agent: Use tools, ask questions
            • ask: No code generation, explain only
          - Custom AI rules from .ai-rules
          - Supabase context (if project uses Supabase)
          - Turbo Edits instructions (search-replace format)
      
  8.2 BUILD CHAT HISTORY
      └─> Convert DB messages to ModelMessage[]:
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: codebase + userMessage1 },
            { role: "assistant", content: aiResponse1 },
            { role: "user", content: userMessage2 },
            // ... up to MAX_CHAT_TURNS_IN_CONTEXT
          ]
      
  8.3 ADD CODEBASE TO FIRST USER MESSAGE
      └─> Prepend codebase context to first user message:
          "Here is the current codebase:\n\n" + codebaseInfo + "\n\n" + userPrompt
      
  8.4 HANDLE MIXED CONTENT (Text + Images)
      └─> For messages with attachments:
          {
            role: "user",
            content: [
              { type: "text", text: "Add a logo here" },
              { type: "image", image: "data:image/png;base64,..." }
            ]
          }
      
  8.5 LIMIT CONTEXT WINDOW
      └─> Keep only recent N messages:
          - Prevents token limit errors
          - Configurable: MAX_CHAT_TURNS_IN_CONTEXT = 20
          - Always include system prompt + codebase

═══════════════════════════════════════════════════════════════════════════════
STEP 9: CONFIGURE PROVIDER OPTIONS
═══════════════════════════════════════════════════════════════════════════════

  9.1 DYAD ENGINE OPTIONS (if enabled)
      └─> {
            "dyad-engine": {
              dyadAppId: chat.app.id,
              dyadRequestId: uuidv4(), // For request tracking
              dyadFiles: files, // Structured codebase
              dyadVersionedFiles: versionedFiles, // With git history
              dyadMentionedApps: mentionedAppsCodebases // Cross-app refs
            }
          }
      
  9.2 OPENAI OPTIONS
      └─> {
            openai: {
              reasoningSummary: "auto" // For o1/o3 models
            }
          }
      
  9.3 ANTHROPIC OPTIONS
      └─> {
            headers: {
              "anthropic-beta": "context-1m-2025-08-07" // 1M token context
            }
          }
      
  9.4 GOOGLE/VERTEX OPTIONS (for thinking models)
      └─> {
            thinkingConfig: {
              thinkingBudget: 10000 // Max thinking tokens
            }
          }
      
  9.5 GENERAL OPTIONS
      └─> {
            maxOutputTokens: getMaxTokens(selectedModel), // 4096-8192
            temperature: getTemperature(selectedModel),   // 0.7-1.0
            maxRetries: 2,
            stopWhen: [stepCountIs(20), hasToolCall("edit-code")]
          }

═══════════════════════════════════════════════════════════════════════════════
STEP 10: CALL AI MODEL (STREAMING)
═══════════════════════════════════════════════════════════════════════════════

📍 Library: Vercel AI SDK (ai package)
📍 Function: streamText()

  10.1 INVOKE STREAMING API
       └─> const { fullStream } = await streamText({
             model: modelClient,
             system: systemPrompt,
             messages: chatMessages,
             tools: mcpTools, // If agent mode
             providerOptions: providerOptions,
             maxRetries: 2,
             abortSignal: abortController.signal
           })
       
       Returns: AsyncIterableStream<TextStreamPart>
       
  10.2 AI MODEL PROCESSES REQUEST
       └─> External API call to:
           - OpenAI API: https://api.openai.com/v1/chat/completions
           - Anthropic API: https://api.anthropic.com/v1/messages
           - Vertex AI: https://[region]-aiplatform.googleapis.com/...
           - Or custom endpoint (Ollama, LM Studio, dyad Engine)
       
       AI model analyzes:
       - System prompt instructions
       - Codebase context
       - Conversation history
       - User request
       
       Generates:
       - Natural language explanation
       - Code changes wrapped in dyad tags
       - File operations (write, rename, delete)
       - Dependency additions
       - SQL migrations (if Supabase project)

═══════════════════════════════════════════════════════════════════════════════
STEP 11: PROCESS STREAMING CHUNKS
═══════════════════════════════════════════════════════════════════════════════

📍 Function: processStreamChunks()

  11.1 ITERATE OVER STREAM
       └─> for await (const part of fullStream) {
             
             Parse chunk type:
             ┌─────────────────────────────────────────────────────┐
             │ Type              │ Description                      │
             ├───────────────────┼──────────────────────────────────┤
             │ "text-delta"      │ Regular response text           │
             │ "reasoning-delta" │ Chain of thought (o1/o3)        │
             │ "thinking-delta"  │ Thinking tokens (Gemini)        │
             │ "tool-call"       │ MCP tool invocation             │
             │ "tool-result"     │ MCP tool response               │
             │ "error"           │ API error                       │
             └─────────────────────────────────────────────────────┘
           }
      
  11.2 ACCUMULATE RESPONSE
       └─> fullResponse += part.text
           - Build complete response incrementally
           - Handle thinking blocks: wrap in <think>...</think>
           - Clean incomplete tags at chunk boundaries
      
  11.3 EMIT CHUNK TO FRONTEND
       └─> Every N characters or on thinking block:
           safeSend(event.sender, "chat:response:chunk", {
             chatId: req.chatId,
             messages: [
               ...existingMessages,
               {
                 role: "assistant",
                 content: fullResponse // Partial response
               }
             ]
           })
           
           Frontend updates UI in real-time with typing effect
      
  11.4 CHECK FOR CANCELLATION
       └─> if (abortController.signal.aborted) {
             break; // Exit loop, cleanup
           }
      
  11.5 HANDLE UNCLOSED TAGS
       └─> If response ends with unclosed <dyad-write>:
           - Attempt continuation (up to 2 retries)
           - Pre-fill assistant role with partial response
           - Call AI again to complete the tag
           - Prevents truncated file writes

═══════════════════════════════════════════════════════════════════════════════
STEP 12: HANDLE AGENT MODE TOOL CALLS (if applicable)
═══════════════════════════════════════════════════════════════════════════════

📍 Condition: settings.selectedChatMode === "agent"

  12.1 DETECT TOOL CALLS
       └─> If AI response contains tool calls:
           - MCP tools (external integrations)
           - generate-code tool (trigger code generation)
      
  12.2 EXECUTE MCP TOOLS
       └─> For each tool call:
           - Invoke MCP server endpoint
           - Get tool result
           - Add result to conversation
           - Continue AI generation with tool context
      
  12.3 HANDLE GENERATE-CODE TOOL
       └─> When called:
           - Switch from agent mode to code generation
           - Apply dyad tag processing
           - Generate actual code changes

═══════════════════════════════════════════════════════════════════════════════
STEP 13: TURBO EDITS V2 DRY RUN (if enabled)
═══════════════════════════════════════════════════════════════════════════════

📍 File: src/ipc/processors/response_processor.ts
📍 Function: dryRunSearchReplace()

  13.1 PARSE SEARCH-REPLACE TAGS
       └─> Extract all <dyad-search-replace> tags:
           <dyad-search-replace path="src/App.tsx">
           OLD CODE HERE
           |||
           NEW CODE HERE
           </dyad-search-replace>
      
  13.2 VALIDATE AGAINST FILES
       └─> For each tag:
           - Check file exists
           - Read current content
           - Attempt to apply search-replace
           - Detect issues:
             • Search text not found
             • Multiple matches (ambiguous)
             • Whitespace mismatches
      
  13.3 COLLECT ISSUES
       └─> issues: Array<{ filePath: string, error: string }>
      
  13.4 RETRY WITH FEEDBACK (if issues found)
       └─> Send issues back to AI:
           "The following search-replace operations failed: ..."
           - AI generates corrected tags
           - Validate again
           - Max 2 retry attempts

═══════════════════════════════════════════════════════════════════════════════
STEP 14: SAVE AI RESPONSE TO DATABASE
═══════════════════════════════════════════════════════════════════════════════

📍 Database: messages table

  14.1 INSERT ASSISTANT MESSAGE
       └─> db.insert(messages).values({
             chatId: req.chatId,
             role: "assistant",
             content: fullResponse, // Complete AI response
             requestId: dyadRequestId, // For tracking
             createdAt: new Date()
           }).returning()
       
       Returns: placeholderAssistantMessage (with ID)

═══════════════════════════════════════════════════════════════════════════════
STEP 15: PARSE & EXECUTE FILE OPERATIONS
═══════════════════════════════════════════════════════════════════════════════

📍 File: src/ipc/processors/response_processor.ts
📍 Function: processFullResponseActions()

  15.1 PARSE ALL DYAD TAGS
       └─> Extract from fullResponse:
           
           A) <dyad-write path="src/Button.tsx">
              export function Button() { ... }
              </dyad-write>
              
           B) <dyad-rename from="old.ts" to="new.ts" />
              
           C) <dyad-delete path="unused.ts" />
              
           D) <dyad-add-dependency type="npm">
              lodash@4.17.21
              </dyad-add-dependency>
              
           E) <dyad-execute-sql>
              CREATE TABLE users (id SERIAL PRIMARY KEY, ...);
              </dyad-execute-sql>
              
           F) <dyad-search-replace path="src/App.tsx">
              old code|||new code
              </dyad-search-replace>
      
  15.2 EXECUTE WRITE OPERATIONS
       └─> For each <dyad-write> tag:
           
           a) Extract file path and content
           b) Resolve absolute path: safeJoin(appPath, relativePath)
           c) Ensure parent directory exists: mkdirSync(recursive: true)
           d) Write file: writeFileSync(fullPath, content, 'utf8')
           e) Track in writtenFiles array
           
           Example paths:
           - src/components/Header.tsx
           - styles/main.css
           - public/index.html
           - package.json (merge, don't overwrite)
      
  15.3 EXECUTE RENAME OPERATIONS
       └─> For each <dyad-rename> tag:
           
           a) Resolve from/to paths
           b) Check source exists
           c) Move: renameSync(fromPath, toPath)
           d) Update git tracking
           e) Track in renamedFiles array
      
  15.4 EXECUTE DELETE OPERATIONS
       └─> For each <dyad-delete> tag:
           
           a) Resolve file path
           b) Check file exists
           c) Delete: unlinkSync(filePath) or rmSync(dir, {recursive: true})
           d) Track in deletedFiles array
           
           Security: Validate path is within app directory (prevent ../.. attacks)
      
  15.5 EXECUTE SEARCH-REPLACE OPERATIONS
       └─> For each <dyad-search-replace> tag:
           
           a) Read current file content
           b) Split on ||| delimiter: [searchText, replaceText]
           c) Apply replacement: content.replace(searchText, replaceText)
           d) Validate: Ensure exactly one match
           e) Write updated content back
           f) Track in editedFiles array
      
  15.6 TRACK ALL CHANGES
       └─> Collect all modified files:
           updatedFiles = [
             ...writtenFiles,
             ...renamedFiles,
             ...deletedFiles,
             ...editedFiles
           ]

═══════════════════════════════════════════════════════════════════════════════
STEP 16: GIT COMMIT (Version Control)
═══════════════════════════════════════════════════════════════════════════════

📍 File: src/ipc/utils/git_utils.ts
📍 Function: gitCommit()

  16.1 STAGE CHANGES
       └─> git.add({
             fs,
             dir: appPath,
             filepath: '.' // Stage all changes
           })
       
       Stages:
       - New files (created by dyad-write)
       - Modified files (edited by search-replace)
       - Deleted files (removed by dyad-delete)
       - Renamed files (moved by dyad-rename)
      
  16.2 GENERATE COMMIT MESSAGE
       └─> Use chat summary or first line of user prompt:
           "Add authentication flow"
           "Fix bug in payment processing"
           "Update dashboard UI"
      
  16.3 CREATE COMMIT
       └─> git.commit({
             fs,
             dir: appPath,
             message: commitMessage,
             author: {
               name: "dyad AI",
               email: "ai@dyad.sh"
             }
           })
       
       Returns: commitHash (SHA-1)
      
  16.4 UPDATE MESSAGE WITH COMMIT HASH
       └─> db.update(messages)
             .set({ commitHash: commitHash })
             .where(eq(messages.id, placeholderAssistantMessage.id))
       
       Links message to specific code version

═══════════════════════════════════════════════════════════════════════════════
STEP 17: EXECUTE ADDITIONAL ACTIONS
═══════════════════════════════════════════════════════════════════════════════

  17.1 ADD DEPENDENCIES
       └─> For each <dyad-add-dependency> tag:
           
           NPM (Node.js):
           - Parse package.json
           - Add to dependencies or devDependencies
           - Run: npm install <package>
           - Update package-lock.json
           
           PIP (Python):
           - Add to requirements.txt
           - Run: pip install <package>
           - Update environment
      
  17.2 DEPLOY SUPABASE FUNCTIONS
       └─> For each function in supabase/functions/:
           
           a) Detect: Check if path starts with supabase/functions/
           b) Read function code
           c) Call Supabase Management API:
              - Create or update function
              - Deploy to Supabase project
           d) Handle errors (auth, quota, syntax)
      
  17.3 EXECUTE SQL MIGRATIONS
       └─> For each <dyad-execute-sql> tag:
           
           a) Extract SQL code
           b) Generate migration file: migrations/YYYYMMDDHHMMSS_description.sql
           c) Write migration to disk
           d) Execute on database:
              - Neon: Via Neon API
              - Supabase: Via Supabase API
              - Local: Via direct connection
           e) Track applied migrations

═══════════════════════════════════════════════════════════════════════════════
STEP 18: HANDLE EXTRA FILES & CLEANUP
═══════════════════════════════════════════════════════════════════════════════

  18.1 DETECT EXTRA FILES
       └─> Files created outside git tracking:
           - Uploaded attachments (not in codebase context)
           - Temporary files
           - Files in .gitignore
       
       Notify user: These files need manual git add
      
  18.2 CLEANUP FILE UPLOADS STATE
       └─> FileUploadsState.getInstance().clear(chatId)
           - Remove temporary upload references
           - Prevent memory leaks
      
  18.3 SCHEDULE TEMP FILE DELETION
       └─> For attachments stored temporarily:
           - Schedule deletion after 1 hour
           - Prevents disk space issues
           - Use: setTimeout() with unlink()

═══════════════════════════════════════════════════════════════════════════════
STEP 19: SEND COMPLETION RESPONSE TO FRONTEND
═══════════════════════════════════════════════════════════════════════════════

📍 IPC Event: "chat:response:end"

  19.1 EMIT END EVENT
       └─> safeSend(event.sender, "chat:response:end", {
             chatId: req.chatId,
             updatedFiles: updatedFiles.length > 0, // Boolean
             extraFiles: extraFilesArray, // Files needing git add
             extraFilesError: errorMessage || undefined
           })
      
  19.2 CLEANUP RESOURCES
       └─> - Remove AbortController: activeStreams.delete(chatId)
           - Clear file uploads: FileUploadsState.clear(chatId)
           - Release memory

═══════════════════════════════════════════════════════════════════════════════
STEP 20: ERROR HANDLING
═══════════════════════════════════════════════════════════════════════════════

📍 IPC Event: "chat:response:error"

AT ANY POINT, IF ERROR OCCURS:

  20.1 CATCH EXCEPTION
       └─> try { ... } catch (error) {
             logger.error("Error calling LLM:", error);
           }
      
  20.2 SEND ERROR TO FRONTEND
       └─> safeSend(event.sender, "chat:response:error", {
             chatId: req.chatId,
             error: "Sorry, there was an error: " + error.message
           })
      
  20.3 CLEANUP
       └─> - Delete AbortController
           - Clear file uploads
           - Set isStreaming = false in frontend
      
  20.4 COMMON ERRORS
       └─> - API key invalid/missing
           - Rate limit exceeded
           - Context too large (token limit)
           - File write permission denied
           - Git operation failed
           - Network timeout


═══════════════════════════════════════════════════════════════════════════════
                           BACKEND ARCHITECTURE SUMMARY
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXECUTION FLOW SEQUENCE                              │
└─────────────────────────────────────────────────────────────────────────────┘

IPC Request
    ↓
[1] Handler Registration & Abort Setup
    ↓
[2] Database: Load Chat & App
    ↓
[3] Process File Attachments
    ↓
[4] Insert User Message to DB
    ↓
[5] Send Loading State → Frontend
    ↓
[6] Configure AI Model & Provider
    ↓
[7] Extract Codebase Context (glob patterns, smart context)
    ↓
[8] Prepare AI Messages (system prompt + history + codebase)
    ↓
[9] Configure Provider Options (Engine, OpenAI, Anthropic, etc.)
    ↓
[10] Call AI Model (streamText) → External API
    ↓
[11] Process Stream Chunks (emit to frontend in real-time)
    ↓
[12] Handle Agent Tool Calls (if applicable)
    ↓
[13] Turbo Edits V2 Dry Run (validate search-replace)
    ↓
[14] Save AI Response to Database
    ↓
[15] Parse & Execute File Operations (write, rename, delete, search-replace)
    ↓
[16] Git Commit (stage all changes, create commit, link to message)
    ↓
[17] Execute Additional Actions (dependencies, Supabase, SQL)
    ↓
[18] Handle Extra Files & Cleanup
    ↓
[19] Send Completion → Frontend
    ↓
[20] Error Handling (at any step)

┌─────────────────────────────────────────────────────────────────────────────┐
│                         KEY DATA STRUCTURES                                  │
└─────────────────────────────────────────────────────────────────────────────┘

INPUT: ChatStreamParams
{
  prompt: string,              // User message
  chatId: number,              // Chat ID
  redo?: boolean,              // Regenerate last response
  selectedComponent: {         // Optional file to focus on
    relativePath: string,
    label: string
  } | null,
  attachments?: Array<{        // Optional file uploads
    name: string,
    type: string,              // MIME type
    data: string,              // Base64 data URI
    attachmentType: "upload-to-codebase" | "chat-context"
  }>
}

OUTPUT: ChatResponseEnd
{
  chatId: number,
  updatedFiles: boolean,       // Were any files modified?
  extraFiles?: string[],       // Files needing manual git add
  extraFilesError?: string     // Error message if file ops failed
}

STREAMING: "chat:response:chunk"
{
  chatId: number,
  messages: Message[]          // All messages including partial AI response
}

DATABASE: messages table
{
  id: number,                  // Auto-increment
  chatId: number,              // Foreign key to chats
  role: "user" | "assistant",
  content: string,             // Full message text
  approvalState: "approved" | "rejected" | null,
  commitHash: string | null,   // Git commit SHA
  requestId: string | null,    // UUID for tracking
  createdAt: Date
}

┌─────────────────────────────────────────────────────────────────────────────┐
│                          FILE OPERATION TAGS                                 │
└─────────────────────────────────────────────────────────────────────────────┘

AI response can contain these XML-style tags:

1. WRITE FILES
   <dyad-write path="src/Button.tsx">
   export function Button() { return <button>Click</button>; }
   </dyad-write>

2. RENAME FILES/DIRECTORIES
   <dyad-rename from="old-name.ts" to="new-name.ts" />

3. DELETE FILES/DIRECTORIES
   <dyad-delete path="unused-file.ts" />

4. ADD DEPENDENCIES
   <dyad-add-dependency type="npm">lodash@4.17.21</dyad-add-dependency>
   <dyad-add-dependency type="pip">numpy==1.24.0</dyad-add-dependency>

5. EXECUTE SQL (Migrations)
   <dyad-execute-sql>
   CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);
   </dyad-execute-sql>

6. SEARCH-REPLACE EDITS
   <dyad-search-replace path="src/App.tsx">
   const old = "old code";
   |||
   const new = "new code";
   </dyad-search-replace>

Backend parses these tags and executes corresponding file system operations.

┌─────────────────────────────────────────────────────────────────────────────┐
│                        SUPPORTED AI PROVIDERS                                │
└─────────────────────────────────────────────────────────────────────────────┘

Provider         │ Models                    │ SDK Package
─────────────────┼───────────────────────────┼──────────────────────────────
OpenAI           │ GPT-4, o1, o3-mini       │ @ai-sdk/openai
Anthropic        │ Claude 3.5 Sonnet        │ @ai-sdk/anthropic
Google Vertex    │ Gemini 2.0 Flash         │ @ai-sdk/google-vertex
Google AI        │ Gemini Pro               │ @ai-sdk/google
Azure OpenAI     │ GPT-4                    │ @ai-sdk/azure
AWS Bedrock      │ Claude, Llama            │ @ai-sdk/amazon-bedrock
xAI              │ Grok                     │ @ai-sdk/xai
OpenRouter       │ Multiple models          │ @openrouter/ai-sdk-provider
Ollama           │ Local models             │ @ai-sdk/openai-compatible
LM Studio        │ Local models             │ @ai-sdk/openai-compatible
dyad Engine      │ Proxy with optimization  │ @ai-sdk/openai-compatible

All providers use Vercel AI SDK's unified streaming interface.

┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND FILE STRUCTURE                               │
└─────────────────────────────────────────────────────────────────────────────┘

src/ipc/
├── handlers/
│   ├── chat_stream_handlers.ts       # Main chat streaming logic (Step 1-20)
│   ├── chat_handlers.ts              # Chat CRUD operations
│   ├── app_handlers.ts               # App management
│   └── testing_chat_handlers.ts      # Canned test responses
├── processors/
│   ├── response_processor.ts         # Parse & execute dyad tags (Step 15-18)
│   └── search_replace_processor.ts   # Turbo Edits V2 implementation
├── utils/
│   ├── get_model_client.ts           # AI provider configuration (Step 6)
│   ├── dyad_tag_parser.ts            # Extract tags from AI response
│   ├── git_utils.ts                  # Git operations (Step 16)
│   ├── file_utils.ts                 # File I/O helpers
│   ├── file_uploads_state.ts         # Track uploaded files (Step 3)
│   ├── context_paths_utils.ts        # Chat context validation
│   └── token_utils.ts                # Token counting & limits
├── ipc_client.ts                     # Frontend IPC client
├── ipc_host.ts                       # Backend IPC registration
└── ipc_types.ts                      # TypeScript interfaces

src/utils/
├── codebase.ts                       # Context extraction (Step 7)
└── ...

src/db/
├── schema.ts                         # Drizzle ORM schema
└── index.ts                          # Database connection

src/prompts/
├── system_prompt.ts                  # AI instructions (Step 8)
├── supabase_prompt.ts                # Supabase-specific context
└── security_review_prompt.ts         # Code review instructions

┌─────────────────────────────────────────────────────────────────────────────┐
│                          OPTIMIZATION FEATURES                               │
└─────────────────────────────────────────────────────────────────────────────┘

1. SMART CONTEXT (Pro)
   - Auto-detect file references in conversation
   - Include related files without manual selection
   - Reduces context management overhead

2. VERSIONED FILES (Engine + Deep Context)
   - Send git history with file content
   - AI understands code evolution
   - Better change recommendations

3. VIRTUAL FILE SYSTEM
   - Track pending changes in memory during multi-turn edits
   - Apply previous changes before extracting context again
   - Consistent state across conversation

4. FILE CONTENT CACHING
   - Cache file reads during context extraction
   - Avoid redundant disk I/O
   - Faster subsequent context builds

5. ABORT CONTROL
   - Cancel in-flight AI requests via AbortController
   - Clean up resources (streams, file handles, temp files)
   - Responsive cancellation UX

6. INCREMENTAL STREAMING
   - Send chunks to frontend immediately as they arrive
   - Don't buffer entire response
   - Lower perceived latency

7. REQUEST ID TRACKING
   - UUID per AI request
   - Correlate with Engine logs
   - Debug production issues
   - Usage analytics

8. TURBO EDITS V2 (Pro)
   - Validate search-replace before applying
   - Detect ambiguous matches
   - Retry with error feedback to AI
   - Prevent broken edits

┌─────────────────────────────────────────────────────────────────────────────┐
│                        SECURITY & VALIDATION                                 │
└─────────────────────────────────────────────────────────────────────────────┘

1. PATH VALIDATION
   - All file operations use safeJoin()
   - Prevents directory traversal attacks (../..)
   - Constrain operations to app directory

2. IPC BOUNDARY
   - All channels validated in preload.ts allowlist
   - No direct renderer access to Node.js APIs
   - Strict parameter validation

3. FILE PERMISSIONS
   - Check write permissions before operations
   - Handle EACCES errors gracefully
   - User feedback on permission issues

4. GIT SAFETY
   - All changes committed before executing
   - User can revert via git
   - Commit messages trace AI decisions

5. API KEY PROTECTION
   - Keys stored in settings, never exposed to renderer
   - Encrypted at rest
   - Not logged or sent to external services (except AI providers)

6. RATE LIMITING
   - Respect AI provider rate limits
   - Exponential backoff on 429 errors
   - User feedback on quota exceeded

7. INPUT SANITIZATION
   - Validate prompt length
   - Check attachment sizes
   - Prevent injection attacks in SQL/shell commands

┌─────────────────────────────────────────────────────────────────────────────┐
│                          ERROR RECOVERY STRATEGIES                           │
└─────────────────────────────────────────────────────────────────────────────┘

ERROR TYPE              │ RECOVERY STRATEGY
────────────────────────┼──────────────────────────────────────────────────
API Key Invalid         │ Show settings modal, prompt user to enter key
Rate Limit Exceeded     │ Show retry countdown, queue request
Context Too Large       │ Reduce context (fewer files/messages), retry
File Write Denied       │ Check permissions, show error, don't commit
Git Operation Failed    │ Rollback file changes, log error, alert user
Network Timeout         │ Retry with exponential backoff (3 attempts)
AI Response Truncated   │ Attempt continuation (up to 2 times)
Unclosed Tag            │ Continuation with pre-filled partial response
Search-Replace Failed   │ Send error to AI, request corrected tags
Tool Call Error (MCP)   │ Return error to AI, continue conversation
Database Lock           │ Retry with delay, queue operation

All errors are logged to electron-log for debugging.

```

## Key Architectural Principles

### 1. **Streaming-First Design**
- All AI responses streamed incrementally to frontend
- Backend processes chunks as they arrive (not buffered)
- Real-time UI updates for better UX

### 2. **Database as Source of Truth**
- Every message persisted before processing
- UI can reload state from DB at any time
- Git commits linked to specific messages

### 3. **IPC Security Boundary**
- Strict allowlist in preload.ts
- All file operations in main process only
- No eval() or unsanitized code execution

### 4. **Provider Agnostic**
- Unified interface via Vercel AI SDK
- Easy to add new providers
- Consistent behavior across models

### 5. **Git-Based Version Control**
- Every AI-generated change creates a commit
- Users can revert via standard git tools
- Full audit trail of AI decisions

### 6. **Graceful Degradation**
- Continue on non-critical errors
- Partial success is acceptable
- Always provide user feedback

### 7. **Performance Optimization**
- Caching at multiple levels
- Parallel operations where possible
- Lazy loading of context

## Backend Entry Points

### IPC Handlers (src/ipc/handlers/)
- `chat:stream` - Main streaming endpoint (this diagram)
- `chat:cancel` - Cancel ongoing stream
- `create-chat` - Create new chat for app
- `get-chat` - Fetch chat with messages
- `update-chat` - Update chat metadata
- `delete-chat` - Delete chat and messages

### Database Tables (src/db/schema.ts)
- `apps` - User apps/projects
- `chats` - Conversations within apps
- `messages` - Individual chat messages
- `settings` - User preferences (model, keys, etc.)

### Core Utilities
- `src/utils/codebase.ts` - Context extraction
- `src/ipc/utils/get_model_client.ts` - AI provider setup
- `src/ipc/processors/response_processor.ts` - File operations
- `src/prompts/system_prompt.ts` - AI instructions
