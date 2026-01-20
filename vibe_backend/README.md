# Vibe Backend Server

A standalone Express.js backend for Vibe, providing a modern REST API and WebSocket support for real-time features. This backend is designed for easy containerization, database integration, and multi-provider AI support.

## Tech Stack

- **Runtime:** Node.js 18+ (Dockerized with Node 22)
- **Framework:** Express.js 4.18
- **Database:** PostgreSQL (via Drizzle ORM and postgres.js)
- **ORM:** Drizzle ORM
- **Git Integration:** isomorphic-git
- **TypeScript:** 5+
- **Containerization:** Docker(with lifecycle management)
- **Security:** helmet, express-rate-limit, CORS, dotenv
- **API Docs:** Swagger (swagger-ui-express)
- **AI Providers:** OpenAI, Anthropic, Google Gemini, Azure Foundry

---

## Getting Started

### 1. Configure Environment Variables

All configuration is done via the `.env` file. This file controls database, server, authentication, AI, and container settings.

#### Step-by-step .env setup:

1. **Copy the example file:**
	```bash
	cp env.example .env
	```
	If `env.example` is missing, create a new `.env` file in the root of `vibe_backend`.

2. **Edit `.env`** with your favorite editor. Here are the most important variables:

	- `PORT=3001` — The port the backend will run on.
	- `NODE_ENV=development` — Set to `production` for live deployments.
	- `DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>` — Your PostgreSQL connection string. Example:
	```
	DATABASE_URL=postgresql://vibemc_user:your_password@<server>:<port>/vibemc
	```
	- `USE_HTTPS=false` — Set to `true` if you want HTTPS (requires SSL certs).
	- `FRONTEND_URL=http://localhost:5173` — The URL of your frontend (for CORS).
		- `FRONTEND_URL=http://<server>:<port>` — The URL of your frontend (for CORS).
	- `CONTAINERIZATION_ENABLED=true` — Enable Docker/Podman container support.
	- `OPENAI_API_KEY=your-openai-api-key-here` — (Optional) For AI features.
	- `GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key-here` — (Optional) For Gemini AI.
	- `AUTH_PROVIDER=keycloak` — (Optional) For authentication integration.

	> **Tip:** The `.env` file is well-commented. Read each section for more advanced options (logging, container limits, AI models, etc).

3. **Save the file.**

### 2. Set Up PostgreSQL

You need a running PostgreSQL instance. Example setup (using psql):

```bash
psql postgres -c "CREATE DATABASE vibemc;"
psql postgres -c "CREATE USER vibemc_user WITH PASSWORD 'your_password';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE vibemc TO vibemc_user;"
```

Update your `.env` with the correct `DATABASE_URL`.

#### Important Environment Variables for Database and Limits

- `DATABASE_URL` — **PostgreSQL connection string.**
	- Format: `postgresql://<user>:<password>@<host>:<port>/<database>`
	- Example: `postgresql://vibemc_user:your_password@localhost:5432/vibemc`
	- This tells the backend how to connect to your PostgreSQL database. Make sure the user, password, host, port, and database name match your setup.

- `DEFAULT_LIMIT` — **Default payload size limit for requests.**
	- Example: `DEFAULT_LIMIT=10mb`
	- Controls the maximum size of JSON or form data the backend will accept in requests. Set to a value like `10mb` for most use cases.

- `ATTACHMENT_SIZE_LIMIT_MB` — **Maximum file upload size.**
	- Example: `ATTACHMENT_SIZE_LIMIT_MB=50mb`
	- Limits the size of file attachments (uploads) to the backend. Increase if you need to support larger files.

- `RATE_LIMIT_WINDOW_MS` — **Rate limiting window (milliseconds).**
	- Example: `RATE_LIMIT_WINDOW_MS=60000` (1 minute)
	- Controls how often rate limits reset. Used to prevent abuse by limiting requests per IP per time window.

- `RATE_LIMIT_MAX` — **Maximum requests per window.**
	- Example: `RATE_LIMIT_MAX=100`
	- The maximum number of requests allowed from a single IP in each window (as defined above). Increase for higher traffic, decrease for stricter limits.

> **Tip:** Adjust these values in your `.env` file to match your application's needs and server capacity. After editing, restart the backend to apply changes.

---

### 3. Configure Authentication and GitHub Integration

#### a) Keycloak Authentication (`AUTH_PROVIDER`)

To enable authentication with Keycloak, fill out the following variables in your `.env`:

```
#AUTH_PROVIDER
AUTH_ISSUER_URL=https://<your-keycloak-domain>/realms/<realm-name>
AUTH_PROVIDER=keycloak
AUTH_CLIENT_ID=<client-id>
AUTH_CLIENT_SECRET=<client-secret>
	AUTH_REDIRECT_URI=https://<server>:<port>/api/auth/callback
AUTH_LOGOUT_ENDPOINT=/protocol/openid-connect/logout
# Endpoints
AUTH_TOKEN_ENDPOINT=/protocol/openid-connect/token
AUTH_USERINFO_ENDPOINT=/protocol/openid-connect/userinfo
```

**How to configure:**

1. Log in to your Keycloak admin panel.
2. Create a new Realm (or use an existing one).
3. Create a new Client (type: confidential) for your backend:
	- Set the redirect URI to your backend: `https://<your-backend-domain>/api/auth/callback`
	- Enable "Standard Flow" and "Direct Access Grants".
	- Copy the Client ID and Secret into your `.env`.
4. Set `AUTH_ISSUER_URL` to your Keycloak realm URL (e.g., `https://keycloak.example.com/realms/vibe-web`).
5. The endpoints are usually standard for Keycloak, but adjust if your setup is custom.
6. Restart the backend after editing `.env`.

> **Note:** If you do not need authentication, you can leave these variables blank or remove them.

#### b) GitHub OAuth Integration

To enable GitHub login or git operations, fill out the following variables in your `.env`:

```
#Git Configuration
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
	GITHUB_REDIRECT_URI=http://<server>:<port>/api/auth/git/callback
GIT_TOKEN_ENCRYPTION_KEY=<32-char-random-string>
```

**How to configure:**

1. Go to https://github.com/settings/developers and create a new OAuth App.
2. Set the Authorization callback URL to `http://localhost:3001/api/auth/git/callback` (or your deployed backend URL).
	2. Set the Authorization callback URL to `http://<server>:<port>/api/auth/git/callback` (or your deployed backend URL).
3. Copy the Client ID and Client Secret into your `.env`.
4. Set `GIT_TOKEN_ENCRYPTION_KEY` to a secure, random 32-character string (used to encrypt git tokens).
5. Restart the backend after editing `.env`.

---

### 4. Push Database Schema

This will create all tables in your database:

```bash
npm run db:push
```

If you want to use migrations:

```bash
npm run db:generate
npm run db:migrate
```
---

### 5. Where Are Generated Apps Stored?

When you create a new app from the frontend, the backend stores the generated app files in a directory that depends on your deployment setup and the following environment variables:

#### App Storage Paths

- `APPS_BASE_DIR`: **Path inside the backend container where apps are stored.**
	- Example: `APPS_BASE_DIR=/app/apps`
	- This is the directory used by the backend process (especially when running in Docker or another container).

- `HOST_APPS_BASE_DIR`: **Actual path on the host machine (used for volume mounts to child containers).**
	- Example: `HOST_APPS_BASE_DIR=/Users/hardik.hadvani/Hardik.Hadvani/Projects/Mastercard_POC/github/vibe_backend/apps`
	- This is the real path on your computer/server where the app folders and files are physically stored.

**How it works:**

- If you run the backend directly (not in Docker), only `APPS_BASE_DIR` matters, and it should be a path accessible to your Node.js process.
- If you use Docker or Podman, `APPS_BASE_DIR` is the path inside the container, and `HOST_APPS_BASE_DIR` is the path on your host machine. Docker mounts the host path into the container, so files are accessible both inside and outside the container.
- Each generated app will have its own folder inside this directory, containing all its files and code.

**To change where apps are stored:**
- Edit `APPS_BASE_DIR` and/or `HOST_APPS_BASE_DIR` in your `.env` file.
- Restart the backend after making changes.

> For most local development, you can set both to the same absolute path, or use the defaults. For production or containerized deployments, make sure the host and container paths are mapped correctly.

---

### 6. Containerization Configuration Explained

The backend supports running apps either as local Node.js processes or inside containers (Docker/Podman). These environment variables control how containerization works:

- `CONTAINERIZATION_ENABLED` — **Enable or disable containerization.**
	- `true`: Apps run inside containers (recommended for isolation and security).
	- `false`: Apps run as local Node.js processes (useful for development or simple setups).

- `DEFAULT_PACKAGE_MANAGER` — **Which package manager to use for generated apps.**
	- Options: `pnpm`, `npm`, `yarn`
	- Used if the app does not specify a lock file. Set to your preferred package manager.

- `AUTO_KILL_PORT` — **Automatically stop processes/containers on occupied ports.**
	- `true`: If a port is already in use, the backend will kill the existing process/container and start the new one.
	- `false`: If a port is occupied, the backend will return an error and not start the app.

- `CONTAINER_INACTIVITY_TIMEOUT` — **How long (in ms) a container can be idle before being stopped.**
	- Example: `1600000` (about 26 minutes)
	- If a containerized app is not used for this period, it will be automatically stopped to save resources.

- `CONTAINER_CPU_LIMIT` — **Maximum number of CPUs a container can use.**
	- Example: `4` (container can use up to 4 CPUs)
	- Controls resource allocation for each app container. Lower for lightweight apps, higher for compute-intensive ones.

- `CONTAINER_MEMORY_LIMIT` — **Maximum memory a container can use.**
	- Example: `1g` (1 gigabyte)
	- Prevents any single app from consuming too much memory. Increase for larger apps, decrease for tighter control.

> **Tip:** Adjust these settings in your `.env` file based on your server capacity and how you want to manage app isolation and resources. For production, containerization is recommended for security and scalability.

---

## API Endpoints

See the OpenAPI/Swagger docs at `http://localhost:3001/api-docs` after starting the server.
See the OpenAPI/Swagger docs at `http://<server>:<port>/api-docs` after starting the server.

---

## Troubleshooting

- **Database connection errors:** Check your `DATABASE_URL` and that PostgreSQL is running.
- **Port already in use:** Change `PORT` in `.env` or stop the conflicting process.
- **Schema out of sync:** Run `npm run db:push` again.

---

## License

MIT (or same as VibeMC main project)
