# Vibe AI App Builder - Web Frontend
 
A modern, local-first AI application builder built with Next.js framework. This frontend provides a fast, private interface for building AI-powered applications with your own API keys.
 
## Prerequisites
 
Before you begin, ensure you have the following installed:
 
- **Node.js** (>= 20.x)
- **npm** or **yarn** or **pnpm**
- **Backend API Server** (running separately - see backend repository)
 
## Getting Started
 
### 1. Clone the Repository
 
```bash
git clone <repository-url>
cd {{repository_name}}
```
 
### 2. Install Dependencies
 
```bash
npm install
```
 
### 3. Configure Environment Variables
 
Copy the example environment file and update it with your configuration:
 
```bash
cp env.local .env
```
 
See [Environment Configuration](#environment-configuration) for details.
 
### 4. Start the Development Server
 
```bash
npm run dev
```
 
The application will be available at [http://localhost:3000](http://localhost:3000)
 
## Environment Configuration
 
Create a `.env.local` file in the root directory with the following variables:
 
```env
# Application Environment
NODE_ENV=development
 
# Backend API Configuration (Required)
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```
 
### Required Configuration
 
- `NEXT_PUBLIC_API_URL`: URL of your backend API server. **Ensure the backend is running before starting the frontend.**
 
## Development
 
### Available Scripts
 
| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build the application for production |
| `npm start` | Start production server |
| `npm run lint` | Run linting checks |
| `npm run lint:fix` | Auto-fix linting issues |
| `npm run prettier` | Format code with Prettier |
| `npm run prettier:check` | Check code formatting |
| `npm run presubmit` | Run formatting and linting checks |
| `npm run ts` | Type-check TypeScript files |
 
### Code Quality
 
This project uses:
 
- **ESLint** for code linting
- **Prettier** for code formatting
- **Oxlint** for fast linting
- **Husky** for git hooks
- **Lint-staged** for pre-commit checks
 
Before committing, run:
 
```bash
npm run presubmit
```
 
## Testing
 
### Unit Tests
 
```bash
# Run all tests
npm test
 
# Watch mode
npm run test:watch
 
# With UI
npm run test:ui
 
# Coverage report
npm run test:coverage
```
 
## Project Structure
 
```
.
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # Reusable React components
│   ├── contexts/         # React Context providers
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility libraries
│   ├── atoms/            # Jotai state atoms
│   ├── api/              # API client utilities
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Helper functions
│   ├── styles/           # Global styles
│   ├── page-components/  # Page-specific components
│   └── pro/              # Pro/premium features
├── public/               # Static assets
├── e2e-tests/            # Playwright E2E tests
├── docs/                 # Documentation
└── shared/               # Shared utilities
```
 
## Tech Stack
 
### Core
 
- **[Next.js 16](https://nextjs.org/)** - React framework with App Router
- **[React 19](https://react.dev/)** - UI library
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
 
### State Management & Data Fetching
 
- **[TanStack Query](https://tanstack.com/query)** - Async state management
- **[Jotai](https://jotai.org/)** - Atomic state management
 
### UI & Styling
 
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS
- **[Radix UI](https://www.radix-ui.com/)** - Headless UI components
- **[Framer Motion](https://www.framer.com/motion/)** - Animations
- **[Lucide React](https://lucide.dev/)** - Icons
 
### Code Editor & Markdown
 
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)** - Code editor
- **[Lexical](https://lexical.dev/)** - Rich text editor
- **[React Markdown](https://remarkjs.github.io/react-markdown/)** - Markdown rendering
- **[Shiki](https://shiki.style/)** - Syntax highlighting
 
### Development Tools
 
- **[Vitest](https://vitest.dev/)** - Unit testing
- **[Playwright](https://playwright.dev/)** - E2E testing
- **[ESLint](https://eslint.org/)** - Linting
- **[Prettier](https://prettier.io/)** - Code formatting