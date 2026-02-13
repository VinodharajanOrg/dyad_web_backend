# Software Architecture Document (SAD)
## Vibe Mastercard - AI App Builder Platform

**Document Version:** 1.0  
**Date:** February 5, 2026  
**Project:** Vibe Mastercard AI App Builder  
**Status:** Production

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Architectural Goals and Constraints](#3-architectural-goals-and-constraints)
4. [System Architecture](#4-system-architecture)
5. [Component Architecture](#5-component-architecture)
6. [Data Architecture](#6-data-architecture)
7. [Security Architecture](#7-security-architecture)
8. [Deployment Architecture](#8-deployment-architecture)
9. [Technology Stack](#9-technology-stack)
10. [Integration Points](#10-integration-points)
11. [Quality Attributes](#11-quality-attributes)
12. [Development and Build Process](#12-development-and-build-process)
13. [Appendices](#13-appendices)

---

## 1. Executive Summary

### 1.1 Purpose
This Software Architecture Document (SAD) provides a comprehensive architectural overview of the Vibe Mastercard AI App Builder Platform. The platform is a unified, containerized full-stack application that enables users to build AI-powered applications through an intuitive web interface.

### 1.2 Scope
This document covers the architectural design of:
- Frontend web application (Next.js)
- Backend API services (Express.js)
- Authentication and authorization system (Keycloak integration)
- Container orchestration and management
- Data persistence layer
- Security infrastructure
- Deployment configuration

### 1.3 Audience
- Software architects and engineers
- DevOps and infrastructure teams
- Security and compliance teams
- Project managers and technical leads
- External auditors and stakeholders

---

## 2. System Overview

### 2.1 Business Context
Vibe Mastercard is an AI-powered application builder that provides:
- **Visual App Builder**: Create applications using AI-assisted development
- **Container Management**: Deploy and manage containerized applications
- **Multi-AI Provider Support**: Integration with multiple AI providers (OpenAI, Anthropic, Google)
- **Real-time Collaboration**: Chat-based interface for AI interactions
- **Code Management**: Git integration for version control
- **Preview & Deployment**: Live preview and deployment capabilities

### 2.2 System Goals
1. **Ease of Use**: Provide intuitive interface for building applications
2. **Security**: Enterprise-grade authentication and authorization
3. **Scalability**: Support multiple concurrent users and applications
4. **Performance**: Fast response times and efficient resource utilization
5. **Maintainability**: Clean, modular architecture for easy updates
6. **Reliability**: High availability with health monitoring and auto-recovery

---

## 3. Architectural Goals and Constraints

### 3.1 Architectural Goals
- **Modularity**: Loosely coupled components for independent scaling
- **Containerization**: Full Docker-based deployment for portability
- **API-First Design**: RESTful APIs for frontend-backend communication
- **Stateless Services**: Horizontal scalability through stateless design
- **Security-First**: Zero-trust security model with authentication at every layer
- **Observability**: Comprehensive logging and health monitoring

### 3.2 Technical Constraints
- Must support HTTPS/SSL for all communications
- Must integrate with existing Keycloak authentication server
- Must support Docker container orchestration
- Must be deployable on-premises infrastructure
- Must support multiple AI provider integrations
- Must handle real-time WebSocket connections

### 3.3 Business Constraints
- Must provide enterprise-grade security
- Must support audit logging and compliance
- Must minimize infrastructure costs through efficient resource usage
- Must support offline development mode

---

## 4. System Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Client Layer                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │    Web Browser (Chrome, Firefox, Safari, Edge)                   │   │
│  │    - React UI Components                                         │   │
│  │    - State Management (Jotai)                                    │   │
│  │    - HTTP/HTTPS Client (Axios)                                   │   │
│  │    - WebSocket Client                                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ HTTPS (SSL/TLS)
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                       Reverse Proxy Layer                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Nginx Reverse Proxy                           │   │
│  │  - SSL/TLS Termination                                           │   │
│  │  - Load Balancing                                                │   │
│  │  - Request Routing                                               │   │
│  │  - Static Asset Serving                                          │   │
│  │  - Health Check Endpoint                                         │   │
│  │                                                                  │   │
│  │  Routes:                                                         │   │
│  │    /          → Frontend (Port 3000)                             │   │
│  │    /api/*     → Backend (Port 3001)                              │   │
│  │    /api-docs  → Swagger Documentation                            │   │
│  │    /health    → Health Check                                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────┬───────────────────────────┬──────────────────────────┘
                 │                           │
     ┌───────────┘                           └──────────────┐
     │                                                      │
┌────▼─────────────────────────┐         ┌─────────────────▼──────────────┐
│   Application Layer          │         │   Application Layer            │
│   Frontend Service           │         │   Backend Service              │
│  ┌────────────────────────┐  │         │  ┌──────────────────────────┐  │
│  │  Next.js Application   │  │         │  │  Express.js Server       │  │
│  │  (Port 3000)           │  │         │  │  (Port 3001)             │  │
│  │                        │  │         │  │                          │  │
│  │  - Server-Side Render  │  │         │  │  - REST API Endpoints    │  │
│  │  - React Components    │  │         │  │  - WebSocket Server      │  │
│  │  - API Client          │  │         │  │  - Authentication        │  │
│  │  - State Management    │  │         │  │  - Authorization         │  │
│  │  - Routing             │  │         │  │  - Business Logic        │  │
│  │  - UI/UX               │  │         │  │  - Container Management  │  │
│  └────────────────────────┘  │         │  │  - AI Provider Client    │  │
│                               │         │  │  - Git Operations        │  │
└───────────────────────────────┘         │  └──────────────────────────┘  │
                                          │                                │
                                          │  ┌──────────────────────────┐  │
                                          │  │  Services Layer          │  │
                                          │  │  - Container Lifecycle   │  │
                                          │  │  - AI Provider Service   │  │
                                          │  │  - File Management       │  │
                                          │  │  - Chat Service          │  │
                                          │  │  - Git Service           │  │
                                          │  └──────────────────────────┘  │
                                          └────────────┬───────────────────┘
                                                       │
                     ┌─────────────────────────────────┼────────────────────┐
                     │                                 │                    │
          ┌──────────▼──────────┐         ┌───────────▼────────┐  ┌────────▼────────┐
          │  Data Layer         │         │  External Layer    │  │  Docker Engine  │
          │  ┌──────────────┐   │         │  ┌──────────────┐  │  │  ┌───────────┐  │
          │  │  PostgreSQL  │   │         │  │  Keycloak    │  │  │  │ Container │  │
          │  │  Database    │   │         │  │  Auth Server │  │  │  │ Runtime   │  │
          │  │              │   │         │  │              │  │  │  │           │  │
          │  │  - Apps Data │   │         │  │  - Users     │  │  │  │ - App     │  │
          │  │  - Chats     │   │         │  │  - Roles     │  │  │  │   Contain │  │
          │  │  - Files     │   │         │  │  - Tokens    │  │  │  │ - Lifecyc │  │
          │  │  - Settings  │   │         │  │  - Sessions  │  │  │  │ - Logs    │  │
          │  └──────────────┘   │         │  └──────────────┘  │  │  └───────────┘  │
          └─────────────────────┘         │                    │  └─────────────────┘
                                          │  ┌──────────────┐  │
                                          │  │  AI Providers│  │
                                          │  │  - OpenAI    │  │
                                          │  │  - Anthropic │  │
                                          │  │  - Google    │  │
                                          │  └──────────────┘  │
                                          └─────────────────────┘
```

### 4.2 Architecture Style
The system follows a **Microservices-Inspired Layered Architecture** with the following characteristics:

1. **Three-Tier Architecture**
   - Presentation Layer (Frontend)
   - Business Logic Layer (Backend API)
   - Data Layer (PostgreSQL)

2. **Service-Oriented Design**
   - Independent, loosely coupled services
   - Each service has a specific responsibility
   - Services communicate via REST APIs

3. **Event-Driven Components**
   - WebSocket for real-time communication
   - Container lifecycle events
   - AI streaming responses

### 4.3 Architectural Patterns

#### 4.3.1 API Gateway Pattern
- Nginx acts as the API gateway
- Single entry point for all client requests
- Routing based on URL paths
- SSL termination at gateway

#### 4.3.2 Service Abstraction Pattern
- Backend services abstracted through interfaces
- Provider-agnostic AI integration
- Swappable implementations

#### 4.3.3 Repository Pattern
- Database access abstracted through Drizzle ORM
- Clean separation of data access logic
- Database-agnostic queries

#### 4.3.4 Container Orchestration Pattern
- Docker for containerization
- Docker Compose for multi-container orchestration
- Health checks for container management

---

## 5. Component Architecture

### 5.1 Frontend Architecture (Next.js)

#### 5.1.1 Component Structure
```
vibe_frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   └── api/                # API routes
│   ├── components/             # React components
│   │   ├── chat/               # Chat interface components
│   │   ├── editor/             # Code editor components
│   │   ├── ui/                 # Reusable UI components
│   │   └── layouts/            # Layout components
│   ├── lib/                    # Utility libraries
│   │   ├── api/                # API client
│   │   ├── auth/               # Authentication helpers
│   │   └── utils/              # Helper functions
│   ├── hooks/                  # Custom React hooks
│   ├── store/                  # State management (Jotai)
│   └── types/                  # TypeScript type definitions
├── public/                     # Static assets
└── styles/                     # Global styles
```

#### 5.1.2 Key Technologies
- **Next.js 16**: React framework with SSR/SSG
- **React 19**: UI library
- **TypeScript 5**: Type safety
- **Jotai**: State management
- **TanStack Query**: Data fetching and caching
- **Monaco Editor**: Code editor component
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Animation library

#### 5.1.3 Frontend Services
- **API Service**: HTTP client for backend communication
- **Auth Service**: Keycloak integration and token management
- **WebSocket Service**: Real-time communication
- **Storage Service**: Local storage management

### 5.2 Backend Architecture (Express.js)

#### 5.2.1 Component Structure
```
vibe_backend/
├── src/
│   ├── index.ts                # Application entry point
│   ├── swagger.ts              # API documentation
│   ├── routes/                 # API route handlers
│   │   ├── apps.ts             # Application management
│   │   ├── chats.ts            # Chat operations
│   │   ├── files.ts            # File management
│   │   ├── git.ts              # Git operations
│   │   ├── settings.ts         # User settings
│   │   ├── providers.ts        # AI provider config
│   │   ├── stream.ts           # AI streaming
│   │   ├── container.ts        # Container management
│   │   ├── container-logs.ts   # Container logs
│   │   ├── auth.ts             # Authentication
│   │   └── preview.ts          # App preview
│   ├── services/               # Business logic services
│   │   ├── container_lifecycle_service.ts
│   │   ├── providers_service.ts
│   │   ├── chat_service.ts
│   │   ├── file_service.ts
│   │   └── git_service.ts
│   ├── middleware/             # Express middleware
│   │   ├── auth.middleware.ts  # Authentication
│   │   ├── errorHandler.ts     # Error handling
│   │   └── cookie-debug.middleware.ts
│   ├── db/                     # Database layer
│   │   ├── schema.ts           # Drizzle schema
│   │   └── index.ts            # Database connection
│   ├── auth/                   # Authentication modules
│   │   └── keycloak.ts         # Keycloak integration
│   ├── config/                 # Configuration
│   ├── types/                  # TypeScript types
│   └── utils/                  # Utility functions
│       └── logger.ts           # Logging utility
├── apps/                       # User-created applications
├── data/                       # Application data
└── drizzle/                    # Database migrations
```

#### 5.2.2 Key Technologies
- **Node.js 20**: Runtime environment
- **Express 4**: Web framework
- **TypeScript 5**: Type safety
- **Drizzle ORM**: Database ORM
- **PostgreSQL**: Database
- **JWT**: Token-based authentication
- **Keycloak Connect**: SSO integration
- **Swagger**: API documentation
- **Winston**: Logging
- **Helmet**: Security middleware
- **Docker SDK**: Container management

#### 5.2.3 Core Services

##### Container Lifecycle Service
- Creates and manages Docker containers for user applications
- Handles container lifecycle (start, stop, restart, delete)
- Monitors container health
- Manages container networking and ports

##### Providers Service
- Manages AI provider configurations
- Handles API key encryption/decryption
- Supports multiple AI providers:
  - OpenAI (GPT models)
  - Anthropic (Claude models)
  - Google (Gemini models)

##### Chat Service
- Manages chat sessions
- Stores and retrieves chat history
- Integrates with AI providers for responses
- Handles streaming responses

##### File Service
- File system operations for user applications
- File upload/download
- Directory management
- File content editing

##### Git Service
- Git repository initialization
- Commit and push operations
- Branch management
- GitHub integration

### 5.3 Reverse Proxy (Nginx)

#### 5.3.1 Responsibilities
- **SSL/TLS Termination**: Handles HTTPS encryption
- **Request Routing**: Routes requests to appropriate services
- **Load Balancing**: Distributes load across instances
- **Static File Serving**: Serves static assets efficiently
- **Security Headers**: Adds security headers to responses
- **Rate Limiting**: Protects against abuse
- **Health Checks**: Monitors service availability

#### 5.3.2 Configuration
```nginx
# Key routing rules:
/          → http://frontend:3000  (Frontend app)
/api/*     → http://backend:3001   (Backend API)
/api-docs  → http://backend:3001   (Swagger docs)
/health    → Health check endpoint
```

### 5.4 Authentication Service (Keycloak)

#### 5.4.1 Responsibilities
- User authentication and authorization
- Single Sign-On (SSO)
- Token management (JWT)
- User and role management
- Session management
- OAuth2/OIDC protocol support

#### 5.4.2 Integration Points
- Backend: Service account for API authentication
- Frontend: Public client for user login
- Token validation on every API request

---

## 6. Data Architecture

### 6.1 Database Schema

#### 6.1.1 Entity-Relationship Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        Database Schema                          │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│    Users     │         │     Apps     │         │    Chats     │
├──────────────┤         ├──────────────┤         ├──────────────┤
│ id (PK)      │────────<│ userId (FK)  │<───────│ appId (FK)   │
│ username     │         │ id (PK)      │         │ id (PK)      │
│ email        │         │ name         │         │ messages     │
│ createdAt    │         │ description  │         │ createdAt    │
│ updatedAt    │         │ repository   │         │ updatedAt    │
└──────────────┘         │ containerId  │         └──────────────┘
                         │ status       │
                         │ createdAt    │
                         │ updatedAt    │
                         └──────────────┘
                                │
                                │
                         ┌──────▼───────┐
                         │    Files     │
                         ├──────────────┤
                         │ id (PK)      │
                         │ appId (FK)   │
                         │ path         │
                         │ content      │
                         │ type         │
                         │ createdAt    │
                         │ updatedAt    │
                         └──────────────┘

┌──────────────┐         ┌──────────────┐
│  Settings    │         │  Providers   │
├──────────────┤         ├──────────────┤
│ id (PK)      │         │ id (PK)      │
│ userId (FK)  │         │ userId (FK)  │
│ key          │         │ name         │
│ value        │         │ apiKey       │
│ createdAt    │         │ model        │
│ updatedAt    │         │ enabled      │
└──────────────┘         │ createdAt    │
                         │ updatedAt    │
                         └──────────────┘
```

#### 6.1.2 Key Tables

**apps**
- Stores user application metadata
- Tracks container associations
- Manages application lifecycle state

**chats**
- Stores chat conversations
- Links to specific applications
- Maintains message history

**files**
- Stores file metadata for applications
- Tracks file changes and versions
- Supports file tree structure

**settings**
- User-specific configuration
- Key-value storage
- Supports various setting types

**providers**
- AI provider configurations
- Encrypted API keys
- Provider-specific settings

### 6.2 Data Flow

#### 6.2.1 Authentication Flow (Keycloak Integration)

**Initial Login Flow:**
```
┌─────────────────────────────────────────────────────────────────┐
│                   Keycloak Authentication Flow                  │
└─────────────────────────────────────────────────────────────────┘

┌────────┐         ┌────────────┐         ┌──────────────┐
│Frontend│         │  Nginx     │         │   Backend    │
└───┬────┘         └───────┬────┘         └──────┬───────┘
    │                      │                     │
    │ 1. User clicks Login │                     │
    ├─────────────────────>│                     │
    │                      │  2. Redirect to KC  │
    │<─────────────────────┤<────────────────────│
    │                      │                     │
    │ 3. Keycloak Login Form                    │
    │  (OAuth2 Auth Code Flow)                  │
    │                      │                     │
    │ 4. Enter Credentials │                     │
    │                      │                     │
    │ 5. Get Auth Code     │                     │
    │<─────────────────────┤                     │
    │                      │                     │
    │ 6. Exchange Code for Token                │
    ├─────────────────────────────────────────>│
    │                      │  7. Validate Code  │
    │                      │<────────────────────│
    │                      │                     │
    │  8. Return Access Token + ID Token        │
    │<─────────────────────────────────────────┤
    │                      │                     │
    │ 9. Store JWT Tokens (HttpOnly Cookies)   │
    │    - accessToken (15 min)                 │
    │    - refreshToken (7 days)                │
    │    - expiresAt                            │
    │                      │                     │
    │ 10. Frontend Ready - Authenticated        │
```

**API Request Flow with Token Validation:**
```
┌────────┐         ┌────────────┐         ┌──────────────┐
│Frontend│         │  Nginx     │         │   Backend    │
└───┬────┘         └───────┬────┘         └──────┬───────┘
    │                      │                     │
    │ 1. API Request       │                     │
    │    + JWT Token       │                     │
    ├─────────────────────>│                     │
    │                      │ 2. Forward to Backend
    │                      │  + JWT Token (Bearer)
    │                      ├────────────────────>│
    │                      │                     │
    │                      │  3. Validate JWT    │
    │                      │     - Signature     │
    │                      │     - Expiration    │
    │                      │     - User Role     │
    │                      │<────────────────────│
    │                      │                     │
    │                      │  4. Extract User ID │
    │                      │     from JWT Claims │
    │                      │                     │
    │                      │  5. Execute Business
    │                      │     Logic (Auth OK) │
    │                      │                     │
    │  6. Return Response with Data             │
    │<─────────────────────────────────────────┤
    │                      │                     │
    │ 7. Update UI         │                     │
    │ 8. Cache in State    │                     │
```

**Token Refresh Flow:**
```
┌────────┐         ┌──────────────┐
│Frontend│         │   Backend    │
└───┬────┘         └──────┬───────┘
    │                     │
    │ 1. AccessToken      │
    │    Expires Soon     │
    │    (< 1 min left)   │
    │                     │
    │ 2. Refresh Request  │
    │  (with refreshToken)│
    ├────────────────────>│
    │                     │
    │    3. Validate      │
    │       RefreshToken  │
    │       with Keycloak │
    │                     │
    │ 4. New AccessToken  │
    │<────────────────────┤
    │                     │
    │ 5. Update JWT       │
    │    (HttpOnly Cookie)│
```

#### 6.2.2 Standard Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        STANDARD HTTP REQUEST FLOW                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: FRONTEND                                                                                                    │
│                                                                                                                      │
│  User Action (Click/Submit)                                                                                        │
│         │                                                                                                           │
│         ├─> Event Handler                                                                                          │
│         │   ├─ Extract input data                                                                                  │
│         │   ├─ Local validation (regex, length, type)                                                              │
│         │   └─ Validation error? → Show error message (stop)                                                       │
│         │                                                                                                           │
│         ├─> State Update (Jotai Atoms)                                                                             │
│         │   ├─ setIsLoading(true)                                                                                  │
│         │   ├─ setError(null)                                                                                      │
│         │   ├─ Disable submit button                                                                               │
│         │   └─ Show loading spinner → Re-render                                                                    │
│         │                                                                                                           │
│         ├─> Build HTTP Request                                                                                    │
│         │   ├─ Method: POST/GET/PUT/DELETE                                                                         │
│         │   ├─ URL: /api/apps/{appId}                                                                              │
│         │   ├─ Headers: {                                                                                           │
│         │   │   Authorization: "Bearer {JWT}",                                                                      │
│         │   │   Content-Type: "application/json",                                                                   │
│         │   │   X-Request-ID: "{uuid}",                                                                             │
│         │   │   Accept: "application/json"                                                                          │
│         │   │ }                                                                                                     │
│         │   ├─ Body: { name, description, ... }                                                                    │
│         │   ├─ Timeout: 30 seconds                                                                                 │
│         │   └─ AbortController: (for cancellation)                                                                 │
│         │                                                                                                           │
│         └─> HTTP Request to Network                                                                               │
│            (TLS encrypted HTTPS)                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                            │
                                                            │ HTTPS Request
                                                            │ (encrypted with TLS 1.3)
                                                            ▼

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: NGINX REVERSE PROXY                                                                                       │
│                                                                                                                      │
│  Request Reception                                                                                                 │
│         │                                                                                                           │
│         ├─> TLS Decryption                                                                                        │
│         │   ├─ Verify certificate validity                                                                         │
│         │   ├─ Extract cipher suite                                                                                │
│         │   └─ Decrypt payload                                                                                     │
│         │                                                                                                           │
│         ├─> Request Parsing                                                                                       │
│         │   ├─ Parse HTTP method, path, query                                                                      │
│         │   ├─ Extract headers                                                                                     │
│         │   └─ Parse body (if present)                                                                             │
│         │                                                                                                           │
│         ├─> Security Checks                                                                                       │
│         │   ├─ Rate limiting: 100 req/min per IP                                                                   │
│         │   │  └─ Exceeded? → Return 429 Too Many Requests                                                         │
│         │   ├─ CORS validation                                                                                     │
│         │   │  ├─ Check Origin header                                                                              │
│         │   │  └─ Add CORS response headers                                                                        │
│         │   └─ SSL certificate check                                                                               │
│         │                                                                                                           │
│         ├─> Request Routing                                                                                       │
│         │   ├─ Match path: /api/* → backend:3001                                                                   │
│         │   ├─ Get backend from connection pool                                                                    │
│         │   │  └─ Pool size: 10-100 connections                                                                    │
│         │   │  └─ Keep-Alive: 60 seconds                                                                           │
│         │   └─ Reuse connection if available                                                                       │
│         │                                                                                                           │
│         ├─> Request Transformation                                                                                │
│         │   ├─ Add proxy headers:                                                                                  │
│         │   │  ├─ X-Real-IP: {client_ip}                                                                           │
│         │   │  ├─ X-Forwarded-For: {client_ip, ...}                                                                │
│         │   │  ├─ X-Forwarded-Proto: https                                                                         │
│         │   │  └─ X-Forwarded-Host: {original_host}                                                                │
│         │   └─ Preserve request ID header                                                                          │
│         │                                                                                                           │
│         └─> Forward to Backend                                                                                    │
│            (HTTP request to backend:3001)                                                                         │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                            │
                                                            │ HTTP Request (internal)
                                                            │ ~1-5ms latency
                                                            ▼

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: BACKEND - MIDDLEWARE CHAIN                                                                                │
│                                                                                                                      │
│  Express Middleware Stack                                                                                          │
│         │                                                                                                           │
│         ├─> Body Parser Middleware                                                                                │
│         │   ├─ Detect Content-Type: application/json                                                               │
│         │   ├─ Max size: 10MB                                                                                      │
│         │   ├─ Parse raw bytes to JSON                                                                             │
│         │   └─ Attach to req.body                                                                                  │
│         │                                                                                                           │
│         ├─> CORS Middleware                                                                                       │
│         │   ├─ Handle preflight (OPTIONS)                                                                          │
│         │   ├─ Add headers:                                                                                        │
│         │   │  ├─ Access-Control-Allow-Origin: *                                                                   │
│         │   │  ├─ Access-Control-Allow-Methods: GET,POST,PUT                                                       │
│         │   │  └─ Access-Control-Allow-Headers: Content-Type,Auth                                                  │
│         │   └─ Pass to next middleware                                                                             │
│         │                                                                                                           │
│         ├─> Helmet Security Middleware                                                                             │
│         │   ├─ Set security headers:                                                                               │
│         │   │  ├─ Content-Security-Policy                                                                          │
│         │   │  ├─ X-Frame-Options: DENY                                                                            │
│         │   │  ├─ X-Content-Type-Options: nosniff                                                                  │
│         │   │  ├─ Strict-Transport-Security: max-age=31536000                                                      │
│         │   │  └─ X-XSS-Protection: 1; mode=block                                                                  │
│         │   └─ Prevent common web vulnerabilities                                                                  │
│         │                                                                                                           │
│         ├─> Compression Middleware                                                                                │
│         │   ├─ Check Accept-Encoding header                                                                        │
│         │   ├─ If gzip supported:                                                                                  │
│         │   │  └─ Enable compression (reduces size ~60%)                                                           │
│         │   └─ Set Content-Encoding header                                                                         │
│         │                                                                                                           │
│         ├─> Request Logging Middleware                                                                             │
│         │   ├─ Log request metadata:                                                                               │
│         │   │  ├─ Timestamp: 2026-02-10T12:34:56Z                                                                  │
│         │   │  ├─ Method: POST                                                                                     │
│         │   │  ├─ Path: /api/apps/123                                                                              │
│         │   │  ├─ IP: 192.168.1.1                                                                                 │
│         │   │  └─ User-Agent: Chrome/120.0                                                                         │
│         │   └─ Winston logger writes to file/console                                                               │
│         │                                                                                                           │
│         └─> Route Handler Reached                                                                                 │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                            │
                                                            │ Request object populated
                                                            │ middleware applied
                                                            ▼

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: BACKEND - AUTHENTICATION & VALIDATION                                                                     │
│                                                                                                                      │
│  Authentication Middleware (requireAuth)                                                                          │
│         │                                                                                                           │
│         ├─> Extract JWT Token                                                                                     │
│         │   ├─ Read Authorization header                                                                           │
│         │   ├─ Extract Bearer token                                                                                │
│         │   └─ Missing? → Return 401 Unauthorized                                                                  │
│         │                                                                                                           │
│         ├─> Validate JWT Signature                                                                                │
│         │   ├─ Decode header.payload.signature                                                                    │
│         │   ├─ Verify signature with Keycloak public key                                                          │
│         │   └─ Invalid? → Return 401 Unauthorized                                                                  │
│         │                                                                                                           │
│         ├─> Check Token Expiration                                                                                │
│         │   ├─ Extract exp claim                                                                                   │
│         │   ├─ Compare with current time                                                                           │
│         │   └─ Expired? → Return 401 Unauthorized                                                                  │
│         │                                                                                                           │
│         ├─> Extract JWT Claims                                                                                    │
│         │   ├─ sub: "user123" (userId)                                                                             │
│         │   ├─ exp: 1707567896                                                                                     │
│         │   ├─ iat: 1707481496                                                                                     │
│         │   ├─ roles: ["user", "admin"]                                                                            │
│         │   ├─ email: "user@example.com"                                                                           │
│         │   └─ name: "John Doe"                                                                                    │
│         │                                                                                                           │
│         ├─> Attach User Context                                                                                   │
│         │   └─ (req as any).user = {                                                                              │
│         │       id: "user123",                                                                                     │
│         │       roles: ["user", "admin"],                                                                          │
│         │       email: "user@example.com"                                                                          │
│         │     }                                                                                                     │
│         │                                                                                                           │
│         └─> Check Token Expiry Soon                                                                               │
│            (< 5 min) → Emit refresh event                                                                         │
│                                                                                                                      │
│                                                                                                                      │
│  Validation Middleware                                                                                            │
│         │                                                                                                           │
│         ├─> Validate Path Parameters                                                                               │
│         │   ├─ Schema: appId must be number                                                                        │
│         │   ├─ Extract from req.params                                                                             │
│         │   └─ Invalid? → Return 400 Bad Request                                                                   │
│         │                                                                                                           │
│         ├─> Validate Query Parameters                                                                              │
│         │   ├─ Optional: limit, offset, sort                                                                       │
│         │   ├─ Type conversion and validation                                                                       │
│         │   └─ Invalid? → Return 400 Bad Request                                                                   │
│         │                                                                                                           │
│         ├─> Validate Request Body                                                                                 │
│         │   ├─ Schema: {                                                                                           │
│         │   │   name: string (required),                                                                           │
│         │   │   description: string (optional),                                                                    │
│         │   │   ...                                                                                                │
│         │   │ }                                                                                                    │
│         │   ├─ Apply Zod schema validation                                                                         │
│         │   ├─ Sanitize input (remove XSS attempts)                                                                │
│         │   ├─ HTML escape special characters                                                                      │
│         │   └─ Invalid? → Return 400 Bad Request                                                                   │
│         │                                                                                                           │
│         └─> Attach Validated Data                                                                                 │
│            req.validated = { params, query, body }                                                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                            │
                                                            │ All validations passed
                                                            │ User context available
                                                            ▼

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: BACKEND - BUSINESS LOGIC                                                                                  │
│                                                                                                                      │
│  Route Handler / Controller                                                                                       │
│         │                                                                                                           │
│         ├─> Extract Request Data                                                                                  │
│         │   ├─ userId = (req as any).user.id                                                                       │
│         │   ├─ appId = req.params.appId                                                                            │
│         │   ├─ { name, description } = req.body                                                                    │
│         │   └─ { limit, offset } = req.query                                                                       │
│         │                                                                                                           │
│         ├─> Authorization Check (RBAC)                                                                             │
│         │   ├─ Check required role: "admin", "app-owner"                                                           │
│         │   ├─ Check user.roles.includes(required)                                                                 │
│         │   └─ Insufficient? → Return 403 Forbidden                                                                │
│         │                                                                                                           │
│         ├─> Call Service Layer                                                                                    │
│         │   └─ appService.updateApp(appId, userId, { name, description })                                         │
│         │                                                                                                           │
│         └─> Service Layer - Business Logic                                                                        │
│            │                                                                                                        │
│            ├─> Pre-Operation Checks                                                                               │
│            │   ├─ Check app exists                                                                                 │
│            │   ├─ SELECT FROM apps WHERE id = appId                                                                │
│            │   ├─ Check user owns app:                                                                             │
│            │   │  └─ app.userId === userId                                                                        │
│            │   └─ Check resource limits                                                                            │
│            │                                                                                                        │
│            ├─> Build Database Query                                                                               │
│            │   ├─ UPDATE apps SET                                                                                  │
│            │   │   name = $1,                                                                                      │
│            │   │   description = $2,                                                                               │
│            │   │   updatedAt = NOW()                                                                               │
│            │   │ WHERE id = $3 AND userId = $4                                                                     │
│            │   ├─ Bind parameters: [$name, $desc, $appId, $userId]                                                 │
│            │   └─ Prepared statement (SQL injection prevention)                                                     │
│            │                                                                                                        │
│            └─> Execute Database Operation (see PHASE 6)                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                            │
                                                            │ Prepared query ready
                                                            │ Data validated
                                                            ▼

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 6: DATABASE OPERATION                                                                                        │
│                                                                                                                      │
│  Database Connection Pool                                                                                         │
│         │                                                                                                           │
│         ├─> Get Connection                                                                                        │
│         │   ├─ Pool state: 5/100 connections active                                                                │
│         │   ├─ Check idle connections in pool                                                                      │
│         │   ├─ Reuse if available (idle < 30s)                                                                     │
│         │   ├─ If not: create new connection (max 100)                                                             │
│         │   └─ Connection established: ~1-5ms                                                                      │
│         │                                                                                                           │
│         ├─> Query Execution                                                                                       │
│         │   ├─ PostgreSQL server receives query                                                                    │
│         │   ├─ Prepare statement                                                                                   │
│         │   ├─ Query planner:                                                                                      │
│         │   │  ├─ Analyze WHERE clause                                                                             │
│         │   │  ├─ Check available indexes:                                                                         │
│         │   │  │  ├─ Index on apps(id)                                                                             │
│         │   │  │  └─ Index on apps(userId)                                                                         │
│         │   │  ├─ Choose optimal execution plan                                                                     │
│         │   │  └─ Estimated rows: 1                                                                                │
│         │   ├─ Execute update:                                                                                     │
│         │   │  ├─ Acquire row lock (FOR UPDATE)                                                                    │
│         │   │  ├─ Update row in buffer                                                                             │
│         │   │  ├─ Update indexes                                                                                   │
│         │   │  └─ Rows affected: 1                                                                                 │
│         │   ├─ Query execution time: ~1-50ms                                                                       │
│         │   └─ Return result set                                                                                   │
│         │                                                                                                           │
│         ├─> Transaction Management                                                                                │
│         │   ├─ BEGIN TRANSACTION                                                                                   │
│         │   ├─ Isolation level: READ COMMITTED                                                                     │
│         │   ├─ Hold locks until COMMIT                                                                             │
│         │   └─ COMMIT TRANSACTION                                                                                  │
│         │      └─ Changes persisted to disk                                                                        │
│         │                                                                                                           │
│         ├─> Result Mapping                                                                                        │
│         │   ├─ Convert rows to TypeScript objects:                                                                 │
│         │   │  └─ {                                                                                                │
│         │   │      id: 123,                                                                                        │
│         │   │      userId: "user456",                                                                              │
│         │   │      name: "My App",                                                                                 │
│         │   │      description: "Updated",                                                                         │
│         │   │      updatedAt: "2026-02-10T12:34:56Z"                                                               │
│         │   │    }                                                                                                 │
│         │   ├─ Type validation (TypeScript)                                                                        │
│         │   └─ Remove sensitive fields                                                                             │
│         │                                                                                                           │
│         └─> Return Connection to Pool                                                                             │
│            └─ Connection stays open (keep-alive) for reuse                                                         │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                            │
                                                            │ DB operation complete
                                                            │ Data retrieved/updated
                                                            ▼

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 7: BACKEND - RESPONSE PREPARATION                                                                            │
│                                                                                                                      │
│  Service Layer - Post-Operation                                                                                   │
│         │                                                                                                           │
│         ├─> Process Results                                                                                       │
│         │   ├─ Transform data format (if needed)                                                                   │
│         │   ├─ Calculate derived values                                                                            │
│         │   ├─ Remove sensitive fields                                                                             │
│         │   └─ Return response object:                                                                             │
│         │      {                                                                                                   │
│         │        success: true,                                                                                    │
│         │        data: {...},                                                                                      │
│         │        message: "App updated successfully"                                                               │
│         │      }                                                                                                    │
│         │                                                                                                           │
│         └─> Side Effects (Optional)                                                                               │
│            ├─ Emit events (for analytics)                                                                          │
│            ├─ Send notifications                                                                                   │
│            ├─ Invalidate cache                                                                                     │
│            └─ Update materialized views                                                                            │
│                                                                                                                      │
│                                                                                                                      │
│  Route Handler - Response Building                                                                                │
│         │                                                                                                           │
│         ├─> Check for Errors                                                                                      │
│         │   ├─ If error:                                                                                           │
│         │   │  ├─ Set status code: 400/403/500                                                                     │
│         │   │  ├─ Build error response                                                                             │
│         │   │  └─ Include error message & details                                                                  │
│         │   └─ Handled in error middleware                                                                         │
│         │                                                                                                           │
│         ├─> Build Success Response                                                                                │
│         │   ├─ HTTP Status: 200 OK                                                                                 │
│         │   ├─ Response Body: {                                                                                    │
│         │   │    status: "success",                                                                                │
│         │   │    data: {...},                                                                                      │
│         │   │    timestamp: "2026-02-10T12:34:56Z"                                                                 │
│         │   │  }                                                                                                   │
│         │   └─ Set response headers:                                                                               │
│         │      ├─ Content-Type: application/json                                                                   │
│         │      ├─ Cache-Control: no-cache (private data)                                                           │
│         │      ├─ ETag: "{hash}" (for caching)                                                                     │
│         │      └─ X-Request-ID: {original uuid}                                                                    │
│         │                                                                                                           │
│         └─> res.json({ ... })                                                                                     │
│            (Send response through middleware chain)                                                                │
│                                                                                                                      │
│                                                                                                                      │
│  Express Response Pipeline                                                                                        │
│         │                                                                                                           │
│         ├─> Serialize to JSON                                                                                     │
│         │   └─ Object → JSON string                                                                                │
│         │                                                                                                           │
│         ├─> Compression (Response)                                                                                │
│         │   ├─ Check Accept-Encoding: gzip                                                                         │
│         │   ├─ If supported:                                                                                       │
│         │   │  ├─ Gzip compression applied                                                                         │
│         │   │  ├─ Size reduced: ~60%                                                                               │
│         │   │  └─ Content-Encoding: gzip header                                                                    │
│         │   └─ Transmission time reduced                                                                           │
│         │                                                                                                           │
│         ├─> Add Response Headers                                                                                  │
│         │   ├─ Content-Length: {bytes}                                                                             │
│         │   ├─ Content-Encoding: gzip                                                                              │
│         │   ├─ X-Content-Type-Options: nosniff                                                                     │
│         │   └─ Security headers (from Helmet)                                                                      │
│         │                                                                                                           │
│         ├─> Write to HTTP Stream                                                                                  │
│         │   ├─ Status line: 200 OK                                                                                 │
│         │   ├─ Headers block                                                                                       │
│         │   ├─ Empty line                                                                                          │
│         │   └─ Body (compressed JSON)                                                                              │
│         │                                                                                                           │
│         ├─> Response Logging                                                                                      │
│         │   ├─ Log response:                                                                                       │
│         │   │  ├─ Status: 200                                                                                      │
│         │   │  ├─ Response time: 45ms                                                                              │
│         │   │  └─ Response size: 1.2KB                                                                             │
│         │   └─ Winston logger                                                                                      │
│         │                                                                                                           │
│         └─> Close Response Stream                                                                                 │
│            (Request-response cycle on backend complete)                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                            │
                                                            │ HTTP Response (compressed)
                                                            │ ~10-100ms network latency
                                                            ▼

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 8: NGINX - RESPONSE FORWARDING                                                                               │
│                                                                                                                      │
│  Response Processing                                                                                              │
│         │                                                                                                           │
│         ├─> Receive from Backend                                                                                  │
│         │   └─ HTTP response: 200 OK with gzipped body                                                             │
│         │                                                                                                           │
│         ├─> Parse Response                                                                                        │
│         │   ├─ Extract status code                                                                                 │
│         │   ├─ Parse headers                                                                                       │
│         │   └─ Validate response                                                                                   │
│         │                                                                                                           │
│         ├─> Response Headers                                                                                      │
│         │   ├─ Remove backend-specific headers                                                                     │
│         │   ├─ Add security headers:                                                                               │
│         │   │  ├─ X-Content-Type-Options: nosniff                                                                  │
│         │   │  ├─ X-Frame-Options: DENY                                                                            │
│         │   │  └─ Strict-Transport-Security                                                                        │
│         │   └─ Add CORS headers (if needed)                                                                        │
│         │                                                                                                           │
│         ├─> TLS Encryption                                                                                        │
│         │   ├─ Encrypt response using TLS 1.3                                                                      │
│         │   ├─ Sign with certificate                                                                               │
│         │   └─ Ready for transmission to client                                                                    │
│         │                                                                                                           │
│         └─> Forward to Client                                                                                     │
│            (HTTPS response over network)                                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                            │
                                                            │ HTTPS Response
                                                            │ (encrypted)
                                                            │ ~10-100ms latency
                                                            ▼

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 9: FRONTEND - RESPONSE HANDLING                                                                              │
│                                                                                                                      │
│  HTTP Client (Axios)                                                                                              │
│         │                                                                                                           │
│         ├─> Response Reception                                                                                    │
│         │   ├─ TLS decryption                                                                                      │
│         │   ├─ HTTP response received                                                                              │
│         │   └─ Response body decompression (gzip)                                                                  │
│         │                                                                                                           │
│         ├─> HTTP Status Check                                                                                     │
│         │   ├─ 200-299: OK                                                                                         │
│         │   ├─ 400: Bad Request (validation error)                                                                 │
│         │   ├─ 401: Unauthorized (token expired/invalid)                                                           │
│         │   ├─ 403: Forbidden (insufficient permissions)                                                           │
│         │   ├─ 500: Server Error (retry logic)                                                                     │
│         │   └─ Route based on status                                                                               │
│         │                                                                                                           │
│         ├─> Response Interceptor                                                                                  │
│         │   ├─ Global response handler runs                                                                        │
│         │   ├─ If 401:                                                                                             │
│         │   │  ├─ POST /api/auth/refresh                                                                           │
│         │   │  ├─ Get new JWT token                                                                                │
│         │   │  └─ Retry original request                                                                           │
│         │   ├─ If 4xx/5xx: pass to error handler                                                                   │
│         │   └─ Parse response JSON                                                                                 │
│         │                                                                                                           │
│         └─> Return to Component                                                                                   │
│            └─ data = { status, data, timestamp }                                                                  │
│                                                                                                                      │
│                                                                                                                      │
│  Component Response Handler                                                                                       │
│         │                                                                                                           │
│         ├─> In Try Block                                                                                          │
│         │   ├─ Receive response data                                                                               │
│         │   ├─ Type validation (TypeScript)                                                                        │
│         │   └─ Extract data from response                                                                          │
│         │                                                                                                           │
│         ├─> Update Jotai State (Atoms)                                                                            │
│         │   ├─ setMessagesById(prev => {                                                                           │
│         │   │    const updated = new Map(prev)                                                                     │
│         │   │    updated.set(chatId, response.data.messages)                                                       │
│         │   │    return updated                                                                                    │
│         │   │  })                                                                                                  │
│         │   ├─ setIsLoading(false)                                                                                 │
│         │   └─ setError(null)                                                                                      │
│         │                                                                                                           │
│         ├─> Trigger React Re-render                                                                               │
│         │   ├─ Component detected atom changes                                                                     │
│         │   └─ Schedule re-render                                                                                  │
│         │                                                                                                           │
│         ├─> Show Success Feedback                                                                                 │
│         │   ├─ Toast notification                                                                                  │
│         │   ├─ Success message: "Updated successfully"                                                             │
│         │   └─ Highlight updated elements                                                                          │
│         │                                                                                                           │
│         └─> Optional: Update Cache                                                                                │
│            ├─ TanStack Query invalidateQueries()                                                                   │
│            └─ Refetch related data                                                                                 │
│                                                                                                                      │
│                                                                                                                      │
│  Error Handling (if error)                                                                                        │
│         │                                                                                                           │
│         └─> In Catch Block                                                                                        │
│            ├─ Catch error from request                                                                             │
│            ├─ Determine error type:                                                                                │
│            │  ├─ Network error: "Unable to connect"                                                                │
│            │  ├─ Validation error: "Invalid input: name too short"                                                 │
│            │  ├─ Auth error: "Your session expired, please log in"                                                 │
│            │  └─ Server error: "Something went wrong. Try again."                                                  │
│            ├─ Update error atom:                                                                                   │
│            │  └─ setError(chatId, error.message)                                                                   │
│            ├─ setIsLoading(false)                                                                                  │
│            ├─ Re-enable submit button                                                                              │
│            ├─ Show error UI:                                                                                       │
│            │  ├─ Red error message                                                                                 │
│            │  ├─ Error icon                                                                                        │
│            │  └─ Retry button                                                                                      │
│            └─ Log error for debugging                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                            │
                                                            │ Atoms updated
                                                            │ Component detected changes
                                                            ▼

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 10: REACT RENDERING & DOM UPDATE                                                                             │
│                                                                                                                      │
│  React Component Re-render                                                                                        │
│         │                                                                                                           │
│         ├─> Atoms Changed                                                                                         │
│         │   ├─ isLoading: true → false                                                                             │
│         │   ├─ error: error.message → null                                                                         │
│         │   ├─ messages: old data → new data                                                                       │
│         │   └─ Subscribe notified of changes                                                                       │
│         │                                                                                                           │
│         ├─> Component Function Executes                                                                            │
│         │   ├─ Read new atom values                                                                                │
│         │   ├─ Generate new JSX based on state                                                                     │
│         │   └─ Build new virtual DOM tree                                                                          │
│         │                                                                                                           │
│         ├─> React Reconciliation (Diff)                                                                            │
│         │   ├─ Compare old JSX with new JSX                                                                        │
│         │   ├─ Identify changed elements:                                                                          │
│         │   │  ├─ Loading spinner: REMOVE                                                                          │
│         │   │  ├─ Disabled submit button: ENABLE                                                                   │
│         │   │  ├─ Message content: UPDATE                                                                          │
│         │   │  └─ Error message: REMOVE                                                                            │
│         │   └─ Minimize DOM updates (efficient)                                                                    │
│         │                                                                                                           │
│         ├─> Batch Updates                                                                                         │
│         │   ├─ Multiple state updates → single render                                                              │
│         │   └─ Schedule all DOM updates together                                                                   │
│         │                                                                                                           │
│         └─> Commit Phase                                                                                          │
│            └─ Apply DOM updates                                                                                    │
│                                                                                                                      │
│                                                                                                                      │
│  Browser DOM Updates                                                                                              │
│         │                                                                                                           │
│         ├─> DOM Mutation                                                                                          │
│         │   ├─ Remove loading spinner element                                                                      │
│         │   ├─ Update text content                                                                                 │
│         │   ├─ Modify CSS classes/styles                                                                           │
│         │   ├─ Re-enable buttons                                                                                   │
│         │   └─ DOM tree modified                                                                                   │
│         │                                                                                                           │
│         ├─> Browser Reflow                                                                                        │
│         │   ├─ Calculate layout                                                                                    │
│         │   ├─ Size elements: width, height                                                                        │
│         │   ├─ Position elements: left, top                                                                        │
│         │   └─ Construct render tree                                                                               │
│         │                                                                                                           │
│         ├─> Browser Repaint                                                                                       │
│         │   ├─ Rasterize pixels                                                                                    │
│         │   ├─ Draw text, images, shapes                                                                           │
│         │   ├─ Apply colors and backgrounds                                                                        │
│         │   └─ Update frame buffer                                                                                 │
│         │                                                                                                           │
│         ├─> Composite Layers                                                                                      │
│         │   ├─ Combine layers                                                                                      │
│         │   ├─ Apply transforms (if any)                                                                           │
│         │   └─ Prepare for display                                                                                 │
│         │                                                                                                           │
│         └─> Display on Screen                                                                                     │
│            ├─ Refresh rate: 60fps (~16ms per frame)                                                                │
│            ├─ User sees updated UI                                                                                 │
│            └─ Request-response cycle COMPLETE!                                                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FINAL STATE                                                                                                          │
│                                                                                                                      │
│  ✓ Loading state: false                                                                                            │
│  ✓ Error state: null                                                                                               │
│  ✓ Data in Jotai atoms: updated                                                                                    │
│  ✓ UI reflects new state                                                                                           │
│  ✓ User can perform next action                                                                                    │
│                                                                                                                      │
│  TOTAL TIME: ~100-500ms                                                                                            │
│  ├─ User interaction: ~5ms                                                                                         │
│  ├─ Frontend preparation: ~15ms                                                                                    │
│  ├─ Network latency (HTTPS): ~50ms                                                                                 │
│  ├─ Backend processing: ~30ms                                                                                      │
│  ├─ Database operation: ~10ms                                                                                      │
│  ├─ Response transmission: ~50ms                                                                                   │
│  ├─ Frontend response handling: ~20ms                                                                              │
│  └─ React re-render & DOM paint: ~20ms                                                                             │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Detailed Step-by-Step:**

```
PHASE 1: Frontend - User Interaction & Preparation

1. User Action (Click, Form Submit, Keyboard)
   ├─ Event fired on DOM element
   ├─ React event handler triggered
   └─ Component state initialized
   ↓

2. Frontend Component Handler
   ├─ Extract user input from event
   ├─ Local validation (format, length, type)
   │  ├─ Email validation regex
   │  ├─ Required field checks
   │  └─ Custom validation rules
   ├─ If validation fails:
   │  ├─ Show inline error messages
   │  └─ Return early (stop request)
   ├─ Show loading state via Jotai atom
   │  └─ setIsLoading(true) → triggers UI spinner
   ├─ Disable submit button (prevent duplicate)
   └─ Clear previous errors
   ↓

3. Build HTTP Request
   ├─ Determine HTTP method: GET/POST/PUT/DELETE
   ├─ Build URL path: /api/apps/{appId}
   ├─ Prepare request headers:
   │  ├─ Authorization: Bearer {JWT_TOKEN}
   │  │  (from HttpOnly cookie)
   │  ├─ Content-Type: application/json
   │  ├─ Accept: application/json
   │  ├─ X-Request-ID: {uuid} (for tracing)
   │  └─ User-Agent: {browser}/{version}
   ├─ Prepare request body:
   │  ├─ Convert form data to JSON
   │  ├─ Remove null/undefined fields
   │  ├─ Apply any data transformations
   │  └─ Validate against schema if available
   ├─ Set request timeout: 30 seconds
   └─ Create AbortController for cancellation
   ↓

4. Update Frontend State (Optimistic)
   ├─ Set loading atom: isLoading[chatId] = true
   ├─ Set loading message atom: loadingMsg = "Creating..."
   ├─ Optional: Add optimistic data to state
   │  └─ Allows immediate UI feedback
   │  └─ Will be corrected by server response
   └─ Trigger React re-render
      └─ Component reads Jotai atoms
      └─ Shows loading spinner/disabled button
   ↓

PHASE 2: Network - Request Transmission

5. HTTP Request Transmission
   ├─ Axios/Fetch API initiates request
   ├─ DNS resolution (cached): domain → IP
   ├─ TCP handshake (3-way):
   │  ├─ SYN
   │  ├─ SYN-ACK
   │  └─ ACK
   ├─ TLS/SSL handshake:
   │  ├─ ClientHello with TLS version, cipher suites
   │  ├─ ServerHello with selected cipher, certificate
   │  ├─ Certificate verification (public key trust)
   │  ├─ Key exchange (establish shared secret)
   │  └─ Finished messages
   ├─ HTTP/2 connection established
   ├─ Request sent over encrypted connection
   └─ Network latency: ~10-100ms
   ↓

6. Nginx Reverse Proxy - Request Reception & Routing
   ├─ Nginx worker process receives HTTPS request
   ├─ TLS decryption using private key
   ├─ Extract HTTP method, path, headers
   ├─ SSL/TLS validation:
   │  ├─ Certificate validity check
   │  ├─ Certificate expiration check
   │  └─ Certificate chain verification
   ├─ Request parsing:
   │  ├─ HTTP method: POST, GET, etc.
   │  ├─ Path: /api/apps/123
   │  ├─ Query params extraction
   │  └─ Body parsing (if present)
   ├─ Rate limiting check:
   │  ├─ Track IP address requests
   │  ├─ Check against rate limit (e.g., 100 req/min)
   │  └─ If exceeded: return 429 Too Many Requests
   ├─ CORS headers check:
   │  ├─ Verify Origin header
   │  ├─ Check against allowed origins
   │  └─ If mismatch: add appropriate CORS headers
   ├─ Request routing based on path:
   │  ├─ /api/* → proxy to backend:3001
   │  ├─ / → proxy to frontend:3000
   │  └─ /health → internal health endpoint
   ├─ Add proxy headers:
   │  ├─ X-Real-IP: {client_ip}
   │  ├─ X-Forwarded-For: {client_ip}
   │  ├─ X-Forwarded-Proto: https
   │  └─ X-Forwarded-Host: {original_host}
   ├─ Connection pooling to backend
   │  ├─ Reuse existing connection if available
   │  └─ Keep-Alive timeout: 60 seconds
   └─ Forward request to backend
   ↓

PHASE 3: Backend - Middleware & Authentication Chain

7. Backend Express Server - Request Reception
   ├─ Express app receives request
   ├─ Request object populated with:
   │  ├─ req.method: "POST"
   │  ├─ req.url: "/api/apps/123"
   │  ├─ req.headers: {...}
   │  ├─ req.body: {...}
   │  └─ req.ip: "192.168.1.1"
   └─ Middleware chain begins
   ↓

8. Express Global Middleware (in order)
   ├─ Body Parser Middleware
   │  ├─ Parse Content-Type: application/json
   │  ├─ Convert raw bytes to JSON object
   │  ├─ Max body size check: 10MB
   │  └─ Attach to req.body
   ├─ CORS Middleware
   │  ├─ Check preflight request (OPTIONS)
   │  ├─ Add CORS response headers:
   │  │  ├─ Access-Control-Allow-Origin
   │  │  ├─ Access-Control-Allow-Methods
   │  │  └─ Access-Control-Allow-Headers
   │  └─ Allow request to continue
   ├─ Helmet Security Middleware
   │  ├─ Add security headers:
   │  │  ├─ Content-Security-Policy
   │  │  ├─ X-Frame-Options: DENY
   │  │  ├─ X-Content-Type-Options: nosniff
   │  │  ├─ Strict-Transport-Security
   │  │  └─ X-XSS-Protection
   │  └─ Prevent common vulnerabilities
   ├─ Compression Middleware
   │  ├─ Check Accept-Encoding header
   │  ├─ If gzip supported: enable compression
   │  └─ Reduces response size by ~60%
   ├─ Request Logging Middleware
   │  ├─ Log request metadata:
   │  │  ├─ Timestamp
   │  │  ├─ Method
   │  │  ├─ Path
   │  │  ├─ Status code
   │  │  └─ Response time
   │  └─ Winston logger writes to file/console
   └─ continue to route-specific middleware
   ↓

9. Authentication Middleware (requireAuth)
   ├─ Check if endpoint requires authentication
   ├─ Extract JWT token:
   │  ├─ Check Authorization header:
   │  │  └─ "Authorization: Bearer {JWT}"
   │  ├─ Parse Bearer token
   │  └─ If missing: return 401 Unauthorized
   ├─ Validate JWT locally:
   │  ├─ Check signature:
   │  │  ├─ Decode JWT (header.payload.signature)
   │  │  ├─ Verify signature with Keycloak public key
   │  │  └─ If invalid: return 401 Unauthorized
   │  ├─ Check expiration:
   │  │  ├─ Extract exp claim from payload
   │  │  ├─ Compare with current time
   │  │  └─ If expired: return 401 Unauthorized
   │  └─ Extract claims from payload:
   │     ├─ sub: subject (userId)
   │     ├─ exp: expiration time
   │     ├─ iat: issued at time
   │     ├─ roles: user roles array
   │     ├─ email: user email
   │     └─ name: user name
   ├─ Attach user to request:
   │  └─ (req as any).user = {
   │       id: claims.sub,
   │       roles: claims.roles,
   │       email: claims.email,
   │       name: claims.name
   │     }
   ├─ Check if token expires soon (< 5 min):
   │  ├─ If yes: emit refresh event
   │  └─ Frontend will refresh token in background
   └─ Continue to route handler
   ↓

10. Request Validation Middleware (validate)
    ├─ Schema definition for endpoint:
    │  ├─ Path params schema: appId must be number
    │  ├─ Query params schema: optional limit, offset
    │  └─ Body schema: required name, optional description
    ├─ Validate path parameters:
    │  ├─ Extract from req.params
    │  ├─ Apply schema validation (Zod)
    │  └─ If invalid: return 400 Bad Request
    ├─ Validate query parameters:
    │  ├─ Extract from req.query
    │  ├─ Apply schema validation
    │  └─ If invalid: return 400 Bad Request
    ├─ Validate request body:
    │  ├─ Extract from req.body
    │  ├─ Apply schema validation
    │  ├─ Sanitize input (remove XSS attempts)
    │  └─ If invalid: return 400 Bad Request
    └─ Attach validated data to request:
       └─ req.validated = { params, query, body }
   ↓

PHASE 4: Backend - Business Logic & Database

11. Route Handler / Controller
    ├─ Extract user from request:
    │  └─ userId = (req as any).user.id
    ├─ Extract appId from path:
    │  └─ appId = req.params.appId
    ├─ Extract validated body:
    │  └─ { name, description, ... } = req.body
    ├─ Authorization check (RBAC):
    │  ├─ Verify user has required role
    │  ├─ E.g., must be "admin" or "app-owner"
    │  └─ If unauthorized: return 403 Forbidden
    ├─ Business logic execution:
    │  ├─ Call service method
    │  ├─ Pass userId for multi-tenant filtering
    │  └─ Pass validated parameters
    └─ Handle result or error
   ↓

12. Service Layer - Business Logic
    ├─ Service method receives parameters:
    │  └─ updateApp(appId, userId, updates)
    ├─ Data access preparation:
    │  ├─ Build database query
    │  ├─ Apply multi-tenant filter:
    │  │  └─ Only user's data
    │  └─ Include related data (JOINs)
    ├─ Pre-operation checks:
    │  ├─ Check if app exists
    │  ├─ Check if user owns app
    │  └─ Check resource limits
    └─ Prepare for database operation
   ↓

13. Database Operation (Read/Write)
    ├─ ORM (Drizzle) Query Building:
    │  ├─ SELECT/UPDATE/DELETE query construction
    │  ├─ Apply filters and joins
    │  └─ Generate SQL
    ├─ Database Connection:
    │  ├─ Get connection from pool:
    │  │  ├─ Pool size: 10-100 connections
    │  │  ├─ Idle timeout: 30 seconds
    │  │  └─ Reuse if available
    │  └─ Connection latency: ~1-5ms
    ├─ Transaction Management:
    │  ├─ BEGIN TRANSACTION
    │  ├─ Execute query with timeout: 10 seconds
    │  ├─ Lock acquired (if update)
    │  └─ Rows affected: 1
    ├─ Query Execution:
    │  ├─ PostgreSQL server processes query
    │  ├─ Query plan generation
    │  ├─ Index lookup (if exists)
    │  ├─ Row retrieval/modification
    │  └─ Query time: ~1-50ms
    ├─ Result Mapping:
    │  ├─ Convert DB rows to TypeScript objects
    │  ├─ Type validation
    │  └─ Relationship loading
    ├─ Transaction Commit:
    │  ├─ COMMIT TRANSACTION
    │  └─ Changes persisted to disk
    ├─ Connection Return:
    │  └─ Return connection to pool
    └─ Result returned to service
   ↓

14. Service - Post-Operation
    ├─ Process query results:
    │  ├─ Transform data format
    │  ├─ Remove sensitive fields
    │  └─ Calculate derived values
    ├─ Side effects (if needed):
    │  ├─ Emit events
    │  ├─ Send notifications
    │  └─ Update cache
    └─ Return response object:
       └─ {
            success: true,
            data: {...},
            message: "App updated successfully"
          }
   ↓

PHASE 5: Backend - Response Preparation

15. Route Handler - Response Building
    ├─ Receive result from service
    ├─ Check for errors:
    │  ├─ If error: build error response
    │  ├─ Set appropriate status code
    │  └─ Include error message and details
    ├─ Build success response:
    │  ├─ Set HTTP status: 200 OK
    │  ├─ Prepare response body:
    │  │  └─ {
    │  │      status: "success",
    │  │      data: {...},
    │  │      timestamp: "2026-02-10T12:34:56Z"
    │  │    }
    │  └─ Set response headers:
    │     ├─ Content-Type: application/json
    │     ├─ Cache-Control: no-cache (if private data)
    │     └─ ETag: {hash} (for client caching)
    └─ res.json({ ... })
   ↓

16. Express Response Pipeline
    ├─ Serialize response object to JSON
    ├─ Compression (if supported by client):
    │  ├─ Gzip compression applied
    │  └─ Size reduced by ~60%
    ├─ Add response headers:
    │  ├─ Content-Length: {bytes}
    │  ├─ Content-Encoding: gzip
    │  └─ Security headers (from Helmet)
    ├─ Write response to HTTP stream
    ├─ Close response stream
    └─ Request-response cycle complete
   ↓

PHASE 6: Network - Response Transmission

17. Network Response Transmission
    ├─ TLS encryption of response
    ├─ TCP transmission:
    │  ├─ Fragment into packets
    │  ├─ Sequence numbering
    │  └─ Acknowledgments (ACK)
    ├─ Network latency: ~10-100ms
    └─ Response received by client
   ↓

18. Nginx - Response Processing
    ├─ Receive response from backend
    ├─ Parse response headers
    ├─ Proxy response to client:
    │  ├─ Remove proxy headers
    │  ├─ Add security headers:
    │  │  ├─ X-Content-Type-Options
    │  │  └─ X-Frame-Options
    │  └─ Forward to client via HTTPS
    └─ Close connection (or keep-alive)
   ↓

PHASE 7: Frontend - Response Handling & UI Update

19. Frontend - Response Reception
    ├─ Axios/Fetch API receives response
    ├─ TLS decryption
    ├─ HTTP status check:
    │  ├─ 200: OK - continue
    │  ├─ 400: Bad Request - validation error
    │  ├─ 401: Unauthorized - token expired/invalid
    │  ├─ 403: Forbidden - insufficient permissions
    │  └─ 500: Server Error - retry logic
    ├─ Response headers parsing:
    │  ├─ Content-Type validation
    │  └─ Cache directives
    └─ Response body decompression (if gzipped)
   ↓

20. Response Interceptor (Axios)
    ├─ Global response handler runs
    ├─ Check status code:
    │  ├─ If 200-299: pass to .then()
    │  ├─ If 401: trigger token refresh
    │  │  ├─ POST /api/auth/refresh
    │  │  ├─ Get new JWT token
    │  │  └─ Retry original request
    │  └─ If 4xx/5xx: pass to .catch()
    ├─ Parse response JSON
    ├─ Extract data from response
    └─ Return to component
   ↓

21. Component Response Handler
    ├─ In try block: receive response data
    ├─ Data validation:
    │  ├─ Check if data matches expected structure
    │  └─ Type safety with TypeScript
    ├─ Update Jotai state (atoms):
    │  ├─ setMessagesById(prev => {
    │  │    return new Map(prev).set(chatId, messages)
    │  │  })
    │  ├─ setIsLoading(false)
    │  ├─ setError(null)
    │  └─ Trigger React re-render
    ├─ Optional: Update cached data
    │  ├─ TanStack Query invalidation
    │  └─ Refetch related data
    ├─ Show success feedback:
    │  ├─ Toast notification
    │  ├─ Success message
    │  └─ Highlight updated elements
    └─ Return control to user
   ↓

22. Error Handling (if error)
    ├─ Catch error in component:
    │  └─ catch (error) { ... }
    ├─ Determine error type:
    │  ├─ Network error: "Unable to connect"
    │  ├─ Validation error: "Invalid input"
    │  ├─ Auth error: "Please log in again"
    │  └─ Server error: "Something went wrong"
    ├─ Update error atom:
    │  └─ setError(chatId, error.message)
    ├─ Set loading to false:
    │  └─ setIsLoading(false)
    ├─ Re-enable submit button
    ├─ Show error UI:
    │  ├─ Red error message
    │  ├─ Error icon
    │  └─ Retry button (for retryable errors)
    └─ Log error for debugging
   ↓

PHASE 8: React Re-render & DOM Update

23. React Re-render
    ├─ Atoms changed (Jotai):
    │  ├─ isLoading changed
    │  ├─ error changed
    │  └─ Component detected changes
    ├─ Component function re-executes
    ├─ New JSX generated based on state
    ├─ React reconciliation (virtual DOM diff):
    │  ├─ Compare old and new JSX
    │  ├─ Identify changed elements
    │  └─ Minimize DOM updates
    ├─ Batch updates:
    │  └─ Multiple state updates → single render
    └─ Schedule DOM updates
   ↓

24. DOM Update & Paint
    ├─ React updates DOM elements:
    │  ├─ Remove loading spinner
    │  ├─ Update text content
    │  ├─ Modify classes/styles
    │  └─ Re-enable buttons
    ├─ Browser reflow:
    │  ├─ Calculate layout
    │  ├─ Size and position elements
    │  └─ Tree construction
    ├─ Browser repaint:
    │  ├─ Rasterize pixels
    │  ├─ Draw text, images, shapes
    │  └─ Update frame buffer
    ├─ Composite layers
    ├─ Display on screen:
    │  └─ ~16ms refresh rate (60fps)
    └─ User sees updated UI
   ↓

25. Final State
    ├─ Loading state: false
    ├─ Error state: null
    ├─ Data in atoms: updated
    ├─ UI reflects new state
    ├─ User can perform next action
    └─ Request-response cycle complete
       Total time: ~100-500ms (including network latency)
```

**Caching & Optimization:**
```
Request-Level Caching:
├─ TanStack Query caches by queryKey
├─ Default staleTime: 0 (always refetch)
├─ Default gcTime: 5 minutes
├─ Reuse data within cache duration

Backend Caching:
├─ Query result caching (if implemented)
├─ Database query optimization with indexes
├─ Select only needed columns

Browser Caching:
├─ Static assets cached with ETag
├─ Service Worker for offline support
├─ LocalStorage for non-critical data
```

**Error Recovery:**
```
Network Error:
├─ Retry with exponential backoff
├─ Retry count: 3 times
├─ Backoff: 1s, 2s, 4s
└─ Show error after all retries fail

Timeout Error:
├─ Request timeout: 30 seconds
├─ Show timeout message
└─ Allow user to retry

Validation Error:
├─ Show field-level errors
├─ Highlight problematic fields
└─ Allow user to correct and retry

Authorization Error:
├─ Auto-refresh token if expired
├─ Redirect to login if invalid
└─ Clear stored credentials
```

#### 6.2.3 AI Streaming Flow (Server-Sent Events)

```
┌────────────────────────────────────────────────────────────────────────┐
│                     AI Streaming Flow (SSE)                            │
└────────────────────────────────────────────────────────────────────────┘

User Prompt → Frontend → Nginx → Backend → AI Provider
    ↓                                ↓            ↓
Create Message              Validate Token    Stream Response
    ↓                                ↓            ↓
Store Locally              Store Chat Msg    Chunks Received
    ↓                                ↓            ↓
HTTP POST /api/stream/chat  Process Chunks  Database Store
    ↓                                ↓            ↓
SSE Connection Open        Parse LLM Msgs   Update Chat
    ↓                                ↓            ↓
Listen to Events        Send Events (JSON)  Save to DB
    ↓                                ↓            ↓
Update Message           event: chunk      Commit Tx
    ↓                                ↓            ↓
Render in UI        data: {"text":"..."}  Log Operation
    ↓                                ↓            ↓
Show Loading        Repeat until done    Record Metadata
Animation                   ↓
    ↓                    Close Stream
End Event           Return Success Status
```

**Detailed SSE Streaming Sequence:**
```
1. User enters prompt + selects AI model
2. Frontend calls: POST /api/stream/chat
   {
     chatId: 123,
     prompt: "Create a React component",
     selectedModel: {
       id: "gpt-4",
       name: "GPT-4",
       providerId: "openai"
     },
     chatMode: "auto-code"
   }

3. Backend /api/stream/chat endpoint
   - Extract JWT from Authorization header
   - Validate token with Keycloak
   - Extract userId from JWT
   ↓

4. Load Chat & App from Database
   - SELECT * FROM chats WHERE id = 123 AND userId = {userId}
   - SELECT * FROM apps WHERE id = chat.appId
   - SELECT * FROM messages WHERE chatId = 123 ORDER BY createdAt
   ↓

5. Set SSE Response Headers
   - Content-Type: text/event-stream
   - Cache-Control: no-cache
   - Connection: keep-alive
   - X-Accel-Buffering: no (disable nginx buffering)
   ↓

6. Store User Message
   - INSERT INTO messages (chatId, userId, role, content, createdAt)
   - Return messageId
   ↓

7. Call AI Provider (OpenAI/Anthropic/Google)
   - Build request with chat history
   - Include system prompt
   - Stream: true (enable streaming)
   ↓

8. Process AI Response Stream
   For each chunk received:
   ├─ Parse chunk
   ├─ Extract text content
   ├─ Detect special operations (dyad-write, dyad-execute)
   ├─ Buffer chunks
   └─ Send SSE event:
      event: chunk
      data: {"id":"msg-456","text":"import React...","type":"text"}
   
   ↓

9. Handle File Operations
   If dyad-write detected:
   ├─ Parse file path & content
   ├─ Validate path (security check)
   ├─ Write to app directory
   ├─ Update file in database
   └─ Send SSE event:
      event: file-created
      data: {"path":"src/Button.tsx","status":"created"}
   
   ↓

10. Handle Container Operations
    If dyad-execute detected:
    ├─ Parse command
    ├─ Execute in app container
    ├─ Capture output
    ├─ Send logs via SSE
    └─ Send SSE event:
       event: container-output
       data: {"output":"✓ Dependencies installed"}

   ↓

11. Stream Complete
    - Collect full response text
    - Save complete message to database
    - Send final event:
      event: done
      data: {"id":"msg-456","status":"complete"}
    
    - Close SSE connection
   
   ↓

12. Frontend SSE Handler
    addEventListener('chunk', (event) => {
      const data = JSON.parse(event.data);
      setMessagesById(prev => {
        // Update message content incrementally
        // Append text to last assistant message
        return updatedMessages;
      });
    });

    ↓

13. UI Update
    - Render text as it streams
    - Show file creation toast
    - Display container output
    - Loading animation while streaming
    - Mark as complete when done
```

#### 6.2.4 Docker Preview Integration Flow

```
┌────────────────────────────────────────────────────────────────┐
│              Docker Preview & Container Lifecycle              │
└────────────────────────────────────────────────────────────────┘

User Clicks "Run App" → Frontend → Backend → Docker Engine
         ↓                           ↓           ↓
   Send appId             Check App Exists   Check Container
   Update UI              Validate Permissions  
   Start Loading          Check Resources      
         ↓                ↓           ↓
   Poll Status      Get Container Config  Create/Start
         ↓           Get Port              Container
   Listen for       Load App Code
   Health          
         ↓
   Display
   Preview
```

**Detailed Container Lifecycle Flow:**

```
1. User clicks "Run" button on app

2. Frontend Action
   - POST /api/apps/{appId}/run
   - Send JWT token in Authorization
   - Show loading state "Starting container..."

3. Backend Route Handler (/api/apps/:appId/run)
   - Extract userId from JWT
   - Extract appId from path params
   - Validate user owns app: SELECT * FROM apps WHERE id = appId AND userId = userId
   ↓

4. Container Lifecycle Service
   - Check if container already running
   - If not running:
     ├─ Check port availability (port pool manager)
     ├─ Reserve port (e.g., 32101)
     ├─ Get app path from database
     ├─ Load app code from filesystem
     └─ Prepare container config
   ↓

5. Docker Handler (DockerHandler.ts)
   runContainer(appId):
   ├─ Build image name: dyad-app-{appId}
   ├─ Build container name: dyad-app-{appId}
   ├─ Build volume name: dyad-app-{appId}-vol
   ├─ Create volume: docker volume create {volumeName}
   ├─ Run container:
   │  docker run \
   │    --name dyad-app-{appId} \
   │    --volume {volumeName}:/app/data \
   │    --volume {appPath}:/app/src \
   │    --port {port}:3000 \
   │    --network dyad-network \
   │    --env NODE_ENV=development \
   │    --health-cmd "curl http://localhost:3000/health" \
   │    --health-interval 10s \
   │    --health-timeout 5s \
   │    --health-retries 3 \
   │    dyad-app-{appId}
   │
   └─ Return { containerId, port, status }
   ↓

6. Container Startup
   - Docker daemon starts container
   - Sets up networking (dyad-network bridge)
   - Mounts volumes
   - Starts health checks
   ↓

7. Backend Response
   - Return container port (e.g., 32101)
   - Return status "starting"
   - Send to Frontend:
     {
       success: true,
       appId: 1,
       containerId: "abc123def456",
       port: 32101,
       status: "starting",
       containerUrl: "http://localhost:32101"
     }
   ↓

8. Frontend Polling
   - Start polling: GET /api/container/{appId}/status
   - Every 1 second check:
     { status: "starting" } → { status: "running" }
   - Extract port from response
   - Stop polling when status = "running"
   ↓

9. Container Health Checks
   - Docker runs: curl http://localhost:3000/health
   - Every 10 seconds
   - Waits for success (3 consecutive successes = healthy)
   - Records in containerActivity map
   ↓

10. Preview URL Construction
    Frontend builds iframe src:
    - Protocol: http (internal Docker network)
    - Host: localhost (Nginx will proxy)
    - Port: 32101 (from response)
    - Path: /
    
    Result: http://localhost:32101/
    
    Nginx forwards: localhost:32101 → dyad-app-{appId}:3000
    ↓

11. Display in Preview Panel
    <iframe src="http://localhost:32101/" />
    
    Nginx proxy route:
    /app/preview/{appId}/* → http://dyad-app-{appId}:3000/*
    ↓

12. Container Activity Tracking
    - Record activity timestamp when:
      ├─ Container health check passes
      ├─ HTTP request received
      └─ User interacts with preview
    
    - Track in containerActivity map (in-memory)
    - Check inactivityTimeout (default: 30 min)
    ↓

13. Cleanup Flow
    - If container inactive > 30 min:
      ├─ Log: "Container inactive, scheduling cleanup"
      ├─ Stop container: docker stop {containerName}
      ├─ Remove container: docker rm {containerName}
      ├─ Optionally remove volume: docker volume rm {volumeName}
      ├─ Release port back to pool
      └─ Log cleanup result
    
    - Also triggered by:
      ├─ User clicks "Stop"
      ├─ App is deleted
      └─ Manual cleanup API call
    ↓

14. Container Logs Streaming
    Frontend: GET /api/container/{appId}/logs?follow=true (SSE)
    
    Backend:
    ├─ Set SSE headers
    ├─ Execute: docker logs --follow {containerName}
    ├─ Stream output line by line:
    │  event: log
    │  data: {"line":"[INFO] Server started on 3000"}
    └─ Continue until client disconnects or container stops
```

**Preview Proxy Routing:**
```
User clicks Preview in app
    ↓
Frontend iframe: src="/app/preview/{appId}/"
    ↓
HTTP GET /app/preview/{appId}/
    ↓
Nginx location /app/preview/:
    proxy_pass http://dyad-app-{appId}:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    ↓
Docker bridge network (dyad-network):
    Client (localhost) → dyad-app-{appId}:3000
    ↓
User App Container (Node.js app running on port 3000)
    Returns HTML/CSS/JS
    ↓
Nginx proxies response back
    ↓
Browser renders in iframe
    ↓
User interacts with preview
    (Click buttons, submit forms, etc.)
```

#### 6.2.5 Multi-Tenant Data Isolation

```
Frontend (userId=1)          Frontend (userId=2)
    ↓                            ↓
POST /api/apps/1 + JWT(1)    POST /api/apps/1 + JWT(2)
    ↓                            ↓
Backend validates JWT(1)     Backend validates JWT(2)
Extracts userId=1            Extracts userId=2
    ↓                            ↓
Database Query:              Database Query:
SELECT * FROM apps           SELECT * FROM apps
WHERE id = 1                 WHERE id = 1
AND userId = 1               AND userId = 2
    ↓                            ↓
Result: App 1 data           Result: Access Denied
(User 1 owns app 1)          (User 2 doesn't own app 1)
    ↓                            ↓
Return data to User 1        Return 403 Forbidden
    ↓                            ↓
Frontend displays app        Frontend shows error
```

#### 6.2.6 Complete Request Lifecycle Example

**Scenario: User creates a new chat message and AI responds**

```
Timeline: T+0ms - User Action
├─ User types prompt: "Create a form component"
├─ Frontend creates optimistic message in Jotai
├─ Shows loading animation

T+50ms - Request Sent
├─ Frontend: POST /api/stream/chat
├─ Headers: Authorization: Bearer {JWT}
├─ Body: { chatId: 1, prompt: "...", selectedModel: {...} }

T+100ms - Nginx Processing
├─ Receives HTTPS request
├─ Validates SSL certificate
├─ Routes to backend:3001

T+150ms - Backend Authentication
├─ Express middleware receives request
├─ Extracts JWT from Authorization header
├─ Validates JWT signature & expiration
├─ Calls Keycloak token validation endpoint
├─ Extracts userId from JWT claims

T+200ms - Request Processing
├─ Load chat from database
├─ Load app from database
├─ Load chat history
├─ Validate user owns chat/app
├─ Set SSE response headers

T+250ms - Store User Message
├─ INSERT message to database
├─ Return to backend handler

T+300ms - AI API Call
├─ Build request with chat history
├─ Call OpenAI /v1/chat/completions (streaming)

T+400ms - First Token Received
├─ Parse first chunk from OpenAI
├─ Send SSE event: chunk
├─ Frontend EventListener receives:
│  event: chunk
│  data: {"text":"import React"}

T+410ms - Frontend Updates UI
├─ Parse SSE event
├─ Update Jotai atom with new text
├─ React re-renders message
├─ User sees "import React" appearing

T+800ms - Stream Complete
├─ All chunks received
├─ Full response: "import React from 'react';\n..."
├─ Send SSE event: done
├─ Save complete message to database

T+850ms - Frontend Complete
├─ Receive done event
├─ Stop loading animation
├─ Mark message as sent

T+900ms - User Ready
├─ Message fully displayed
├─ User can send next prompt
├─ Full chat history in database
```

### 6.3 Data Management

#### 6.3.1 Persistence Strategy
- **PostgreSQL**: Primary data store
- **File System**: Application code and assets
- **Docker Volumes**: Container persistent data
- **Logs**: Centralized log storage

#### 6.3.2 Data Security
- **Encryption at Rest**: Encrypted database volumes
- **Encryption in Transit**: HTTPS/TLS for all communications
- **API Key Encryption**: Encrypted storage of sensitive credentials
- **Access Control**: Role-based access control (RBAC)

---

## 7. Security Architecture

### 7.1 Security Layers

```
┌──────────────────────────────────────────────────────────┐
│                    Security Layers                       │
└──────────────────────────────────────────────────────────┘

Layer 1: Transport Security
┌──────────────────────────────────────────────────────────┐
│ • HTTPS/TLS encryption for all communications            │
│ • SSL certificate management                             │
│ • Secure WebSocket (WSS)                                 │
└──────────────────────────────────────────────────────────┘

Layer 2: Network Security
┌──────────────────────────────────────────────────────────┐
│ • Nginx reverse proxy as security boundary               │
│ • Internal Docker network isolation                      │
│ • Firewall rules and port restrictions                   │
│ • Rate limiting and DDoS protection                      │
└──────────────────────────────────────────────────────────┘

Layer 3: Authentication & Authorization
┌──────────────────────────────────────────────────────────┐
│ • Keycloak-based authentication                          │
│ • JWT token validation                                   │
│ • Role-based access control (RBAC)                       │
│ • Session management                                     │
└──────────────────────────────────────────────────────────┘

Layer 4: Application Security
┌──────────────────────────────────────────────────────────┐
│ • Input validation and sanitization                      │
│ • SQL injection prevention (ORM)                         │
│ • XSS protection                                         │
│ • CSRF protection                                        │
│ • Helmet security headers                                │
└──────────────────────────────────────────────────────────┘

Layer 5: Data Security
┌──────────────────────────────────────────────────────────┐
│ • Encrypted API keys and secrets                         │
│ • Database access controls                               │
│ • Secure credential storage                              │
│ • Audit logging                                          │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Authentication Flow

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   Client    │         │   Backend    │         │  Keycloak    │
└──────┬──────┘         └──────┬───────┘         └──────┬───────┘
       │                       │                        │
       │  1. Login Request     │                        │
       │──────────────────────>│                        │
       │                       │  2. Redirect to KC     │
       │                       │───────────────────────>│
       │                       │                        │
       │  3. Login Form                                 │
       │<──────────────────────────────────────────────│
       │                       │                        │
       │  4. Credentials       │                        │
       │───────────────────────────────────────────────>│
       │                       │                        │
       │  5. Auth Code         │                        │
       │<──────────────────────────────────────────────│
       │                       │                        │
       │  6. Exchange Code     │                        │
       │──────────────────────>│                        │
       │                       │  7. Token Request      │
       │                       │───────────────────────>│
       │                       │                        │
       │                       │  8. Access Token + ID  │
       │                       │<───────────────────────│
       │  9. Tokens + Session  │                        │
       │<──────────────────────│                        │
       │                       │                        │
       │ 10. API Request + JWT │                        │
       │──────────────────────>│                        │
       │                       │ 11. Validate Token     │
       │                       │───────────────────────>│
       │                       │                        │
       │                       │ 12. Token Valid        │
       │                       │<───────────────────────│
       │  13. API Response     │                        │
       │<──────────────────────│                        │
```

### 7.3 Security Controls

#### 7.3.1 Authentication
- **Keycloak SSO**: Centralized authentication
- **OAuth2/OIDC**: Industry-standard protocols
- **JWT Tokens**: Stateless authentication
- **Token Refresh**: Automatic token renewal
- **Session Management**: Secure session handling

#### 7.3.2 Authorization
- **Role-Based Access Control (RBAC)**: User roles and permissions
- **Resource-Level Authorization**: Fine-grained access control
- **API Endpoint Protection**: Authenticated endpoints
- **Service Account**: Backend service authentication

#### 7.3.3 API Security
- **Rate Limiting**: Prevent abuse (express-rate-limit)
- **CORS Configuration**: Controlled cross-origin access
- **Helmet Middleware**: Security headers
- **Input Validation**: Request validation with Zod
- **HTML Sanitization**: Prevent XSS attacks (sanitize-html)

#### 7.3.4 Container Security
- **Isolated Networks**: Docker network isolation
- **Resource Limits**: CPU and memory constraints
- **Read-Only Filesystems**: Where applicable
- **Security Scanning**: Regular vulnerability scans

---

## 8. Deployment Architecture

### 8.1 Production Deployment

#### 8.1.1 Two-Server Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                 Server 1: 10.157.147.235                       │
│                 Keycloak Authentication                        │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    Keycloak Server                       │ │
│  │  - Realm: vibe-web                                       │ │
│  │  - Clients: vibe-backend, vibe-mastercard-frontend       │ │
│  │  - User Management                                       │ │
│  │  - Role Management                                       │ │
│  │  - HTTPS: https://10.157.147.235                         │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
                               │
                               │ OAuth2/OIDC
                               │ Token Validation
                               │
┌────────────────────────────────────────────────────────────────┐
│                 Server 2: 10.157.150.207                       │
│                 Application Server                             │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    Nginx (Port 80/443)                   │ │
│  └─────┬──────────────────────────────────────────┬─────────┘ │
│        │                                          │           │
│  ┌─────▼──────────┐                     ┌─────────▼────────┐ │
│  │  Frontend      │                     │  Backend         │ │
│  │  Next.js:3000  │                     │  Express:3001    │ │
│  └────────────────┘                     └──────┬───────────┘ │
│                                                │             │
│  ┌─────────────────────────────────────────────▼───────────┐ │
│  │              PostgreSQL Database                        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Docker Container Engine                     │ │
│  │  - User Application Containers                           │ │
│  │  - Dynamic Container Lifecycle                           │ │
│  └─────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

#### 8.1.2 Container Configuration

**Backend Container**
```yaml
Ports:
  - 3001:3001 (HTTP API)
  - 3443:3443 (HTTPS API)
Volumes:
  - ./ssl:/app/ssl (SSL certificates)
  - ./vibe_backend/data:/app/data (Application data)
  - ./vibe_backend/apps:/app/apps (User apps)
  - /var/run/docker.sock:/var/run/docker.sock (Docker socket)
Environment:
  - DATABASE_URL
  - KEYCLOAK_URL
  - KEYCLOAK_REALM
  - KEYCLOAK_CLIENT_ID
  - KEYCLOAK_CLIENT_SECRET
Health Check:
  - HTTP GET /health
  - Interval: 30s
  - Timeout: 10s
  - Retries: 3
```

**Frontend Container**
```yaml
Ports:
  - 3000:3000 (HTTP)
Volumes:
  - ./ssl:/app/ssl (SSL certificates)
Environment:
  - NEXT_PUBLIC_API_URL
  - KEYCLOAK_FRONTEND_CLIENT_ID
Health Check:
  - HTTP GET /api/health
  - Interval: 30s
  - Timeout: 10s
  - Retries: 3
```

**Nginx Container**
```yaml
Ports:
  - 80:80 (HTTP)
  - 443:443 (HTTPS)
Volumes:
  - ./nginx/nginx.conf:/etc/nginx/nginx.conf
  - ./ssl:/etc/nginx/ssl
  - ./logs/nginx:/var/log/nginx
Health Check:
  - HTTP GET /health
  - Interval: 30s
  - Timeout: 10s
  - Retries: 3
```

### 8.2 Network Architecture

#### 8.2.1 Docker Network Topology
```
┌──────────────────────────────────────────────────────────┐
│              Docker Bridge Network: dyad-network         │
│                                                          │
│  ┌────────────┐    ┌────────────┐    ┌───────────────┐  │
│  │   Nginx    │───>│  Frontend  │    │   Backend     │  │
│  │   :80/443  │    │   :3000    │<───│   :3001       │  │
│  └────────────┘    └────────────┘    └───────┬───────┘  │
│                                               │          │
│                                    ┌──────────▼────────┐ │
│                                    │   PostgreSQL      │ │
│                                    │   :5432           │ │
│                                    └───────────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │         User Application Containers                  ││
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐    ││
│  │  │ App 1  │  │ App 2  │  │ App 3  │  │ App N  │    ││
│  │  └────────┘  └────────┘  └────────┘  └────────┘    ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

#### 8.2.2 Port Mapping
- **External: 80** → Nginx HTTP (redirects to 443)
- **External: 443** → Nginx HTTPS
- **Internal: 3000** → Frontend (Next.js)
- **Internal: 3001** → Backend (Express)
- **Internal: 5432** → PostgreSQL
- **Dynamic** → User application containers

### 8.3 SSL/TLS Configuration

#### 8.3.1 Certificate Management
- Self-signed certificates for development
- Let's Encrypt integration for production
- Centralized SSL directory shared across services
- Automatic certificate renewal

#### 8.3.2 SSL Termination
- Nginx handles SSL termination
- Internal communication can use HTTP
- Backend supports HTTPS for direct access

---

## 9. Technology Stack

### 9.1 Frontend Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | Next.js | 16.1.1 | React framework with SSR/SSG |
| UI Library | React | 19.0.0 | Component-based UI |
| Language | TypeScript | 5.8.3 | Type-safe JavaScript |
| State Management | Jotai | 2.12.2 | Atomic state management |
| Data Fetching | TanStack Query | 5.90.10 | Server state management |
| Styling | Tailwind CSS | 4.1.17 | Utility-first CSS |
| UI Components | Radix UI | Various | Accessible primitives |
| Code Editor | Monaco Editor | 0.55.1 | VS Code editor |
| Markdown | React Markdown | 10.1.0 | Markdown rendering |
| HTTP Client | Axios | 1.13.2 | API communication |
| Animation | Framer Motion | 12.6.3 | UI animations |
| Testing | Vitest | 4.0.13 | Unit testing |
| E2E Testing | Playwright | 1.52.0 | End-to-end testing |

### 9.2 Backend Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Runtime | Node.js | 20 | JavaScript runtime |
| Framework | Express | 4.18.2 | Web framework |
| Language | TypeScript | 5.3.3 | Type-safe JavaScript |
| Database | PostgreSQL | 8.16.3 | Relational database |
| ORM | Drizzle ORM | 0.29.1 | Database abstraction |
| Authentication | Keycloak Connect | 26.1.1 | SSO integration |
| Token Management | jsonwebtoken | 9.0.3 | JWT handling |
| AI SDKs | OpenAI, Anthropic, Google | Latest | AI provider clients |
| Container SDK | Docker SDK | Latest | Container management |
| Git Library | isomorphic-git | 1.25.0 | Git operations |
| API Docs | Swagger | Latest | API documentation |
| Security | Helmet | 8.1.0 | Security headers |
| Rate Limiting | express-rate-limit | 8.2.1 | API rate limiting |
| Validation | Zod | 3.22.4 | Schema validation |
| Sanitization | sanitize-html | 2.17.0 | HTML sanitization |
| Testing | Jest | 30.2.0 | Unit testing |
| Logging | Winston | Custom | Application logging |

### 9.3 Infrastructure Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| Containerization | Docker | Container runtime |
| Orchestration | Docker Compose | Multi-container management |
| Reverse Proxy | Nginx | Load balancing, SSL termination |
| Authentication | Keycloak | IAM and SSO |
| Database | PostgreSQL | Data persistence |
| SSL/TLS | OpenSSL | Certificate generation |
| Monitoring | Docker Health Checks | Service health monitoring |

### 9.4 Development Tools

| Category | Technology | Purpose |
|----------|-----------|---------|
| Package Manager | npm/pnpm | Dependency management |
| Linting | ESLint, oxlint | Code quality |
| Formatting | Prettier | Code formatting |
| Build Tool | Vite | Fast development builds |
| Type Checking | TypeScript Compiler | Type validation |
| Git Hooks | Husky | Pre-commit validation |

---

## 10. Integration Points

### 10.1 External Integrations

#### 10.1.1 Keycloak Authentication
**Integration Type:** OAuth2/OpenID Connect  
**Purpose:** User authentication and authorization  
**Protocol:** HTTPS  
**Endpoints:**
- Authorization: `/realms/vibe-web/protocol/openid-connect/auth`
- Token: `/realms/vibe-web/protocol/openid-connect/token`
- User Info: `/realms/vibe-web/protocol/openid-connect/userinfo`
- Logout: `/realms/vibe-web/protocol/openid-connect/logout`

**Data Flow:**
```
Frontend → Keycloak (Login) → Token → Backend (Validate) → Response
```

#### 10.1.2 OpenAI Integration
**Integration Type:** REST API  
**Purpose:** AI model interactions (GPT models)  
**Authentication:** API Key  
**Endpoints:**
- Chat Completions: `/v1/chat/completions`
- Embeddings: `/v1/embeddings`

#### 10.1.3 Anthropic Integration
**Integration Type:** REST API  
**Purpose:** AI model interactions (Claude models)  
**Authentication:** API Key  
**Endpoints:**
- Messages: `/v1/messages`

#### 10.1.4 Google AI Integration
**Integration Type:** REST API  
**Purpose:** AI model interactions (Gemini models)  
**Authentication:** API Key  
**Endpoints:**
- Generate Content: `/v1/models/*/generateContent`

#### 10.1.5 GitHub Integration
**Integration Type:** Git Protocol / GitHub API  
**Purpose:** Repository management and version control  
**Authentication:** Personal Access Token  
**Features:**
- Repository initialization
- Commit and push
- Branch management

### 10.2 Internal Integrations

#### 10.2.1 Frontend ↔ Backend
**Protocol:** HTTPS / WebSocket  
**Format:** JSON  
**Authentication:** JWT Bearer Token

**API Categories:**
- `/api/apps` - Application CRUD operations
- `/api/chats` - Chat management
- `/api/files` - File operations
- `/api/git` - Git operations
- `/api/settings` - User settings
- `/api/providers` - AI provider configuration
- `/api/stream` - AI streaming responses
- `/api/container` - Container management
- `/api/auth` - Authentication

#### 10.2.2 Backend ↔ PostgreSQL
**Protocol:** PostgreSQL protocol  
**ORM:** Drizzle  
**Connection:** Connection pool  
**Features:**
- Query builder
- Migrations
- Transactions
- Relations

#### 10.2.3 Backend ↔ Docker Engine
**Protocol:** Docker Socket / Docker API  
**Mount:** `/var/run/docker.sock`  
**Features:**
- Container lifecycle management
- Image management
- Network management
- Log streaming

---

## 11. Quality Attributes

### 11.1 Performance

#### 11.1.1 Response Time Targets
- **API Endpoints**: < 200ms (average)
- **Page Load**: < 2 seconds (initial load)
- **AI Response Start**: < 500ms (first token)
- **Container Start**: < 10 seconds

#### 11.1.2 Throughput
- **Concurrent Users**: 100+ users
- **API Requests**: 1000+ requests/minute
- **WebSocket Connections**: 100+ concurrent

#### 11.1.3 Performance Optimizations
- Next.js SSR/SSG for fast initial loads
- React Server Components for reduced bundle size
- TanStack Query for efficient data caching
- Monaco Editor lazy loading
- Image optimization
- Code splitting
- API response caching

### 11.2 Scalability

#### 11.2.1 Horizontal Scaling
- **Frontend**: Stateless, can scale horizontally
- **Backend**: Stateless (session in Keycloak), can scale horizontally
- **Database**: PostgreSQL clustering/replication
- **Nginx**: Multiple instances behind load balancer

#### 11.2.2 Vertical Scaling
- Container resource limits adjustable
- Database memory and CPU configurable
- Node.js worker threads for CPU-intensive tasks

#### 11.2.3 Resource Limits
- Container CPU: 0.5-2 cores (configurable)
- Container Memory: 512MB-2GB (configurable)
- Database connections: 100 (pooled)
- File upload size: 10MB (configurable)

### 11.3 Reliability

#### 11.3.1 High Availability
- **Health Checks**: All services monitored
- **Auto-Restart**: Docker restart policies
- **Graceful Shutdown**: Signal handling
- **Database Backups**: Automated backups
- **Data Replication**: Database replication

#### 11.3.2 Fault Tolerance
- **Retry Logic**: API request retries
- **Circuit Breakers**: Prevent cascade failures
- **Fallback Mechanisms**: Degraded functionality
- **Error Boundaries**: React error boundaries

#### 11.3.3 Recovery
- **Database Recovery**: Point-in-time recovery
- **Container Recovery**: Automatic restart
- **Data Recovery**: Backup restoration
- **State Recovery**: Session persistence

### 11.4 Security

#### 11.4.1 Authentication & Authorization
- Multi-factor authentication support (Keycloak)
- Role-based access control (RBAC)
- JWT token expiration (15 minutes)
- Refresh token rotation
- Session timeout (30 minutes)

#### 11.4.2 Data Protection
- HTTPS/TLS 1.2+ for all communications
- Encrypted API keys (AES-256)
- Encrypted database connections
- Secure cookie settings (httpOnly, secure, sameSite)
- SQL injection prevention (ORM)
- XSS prevention (sanitization)

#### 11.4.3 API Security
- Rate limiting (100 requests/15 minutes)
- CORS policies
- Security headers (Helmet)
- Input validation (Zod)
- Output sanitization

#### 11.4.4 Container Security
- Non-root user execution
- Resource limits
- Network isolation
- Read-only filesystems (where applicable)
- Security scanning

### 11.5 Maintainability

#### 11.5.1 Code Quality
- TypeScript for type safety
- ESLint and Prettier for consistency
- Code review process
- Unit test coverage
- Integration tests
- End-to-end tests

#### 11.5.2 Documentation
- Swagger API documentation
- Code comments
- Architecture documentation
- Deployment guides
- README files

#### 11.5.3 Monitoring & Logging
- Structured logging (Winston)
- Request/response logging
- Error tracking
- Performance monitoring
- Health check endpoints
- Container logs

### 11.6 Usability

#### 11.6.1 User Experience
- Responsive design (mobile, tablet, desktop)
- Intuitive interface
- Real-time feedback
- Loading states
- Error messages
- Keyboard shortcuts

#### 11.6.2 Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support (Radix UI)
- Semantic HTML
- ARIA attributes

---

## 12. Development and Build Process

### 12.1 Development Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Workflow                      │
└─────────────────────────────────────────────────────────────┘

1. Local Development
   ├── Clone Repository
   ├── Install Dependencies (npm install)
   ├── Configure Environment (.env files)
   └── Start Dev Servers
       ├── Frontend: npm run dev (Port 3000)
       └── Backend: npm run dev (Port 3001)

2. Code Development
   ├── Feature Branch Creation
   ├── Code Implementation
   ├── Unit Testing
   └── Local Testing

3. Quality Checks
   ├── Type Checking (npm run typecheck)
   ├── Linting (npm run lint)
   ├── Formatting (npm run prettier)
   ├── Unit Tests (npm run test)
   └── E2E Tests (npm run test:e2e)

4. Code Review
   ├── Pull Request Creation
   ├── Peer Review
   ├── Automated Checks
   └── Approval

5. Build & Deploy
   ├── Docker Build
   ├── Container Registry Push
   ├── Deploy to Environment
   └── Health Check Verification
```

### 12.2 Build Process

#### 12.2.1 Frontend Build
```bash
# Development
npm run dev              # Start dev server with hot reload

# Production Build
npm run build           # Next.js production build
npm run start           # Start production server

# Type Checking
npm run ts              # TypeScript type checking

# Linting
npm run lint            # ESLint + oxlint
npm run lint:fix        # Auto-fix issues

# Testing
npm run test            # Run unit tests
npm run test:coverage   # Coverage report
npm run test:e2e        # Playwright E2E tests
```

#### 12.2.2 Backend Build
```bash
# Development
npm run dev             # Start dev server with watch mode

# Production Build
npm run build           # TypeScript compilation
npm run start           # Start production server

# Type Checking
npm run typecheck       # TypeScript type checking

# Database
npm run db:generate     # Generate migrations
npm run db:migrate      # Run migrations
npm run db:push         # Push schema to DB

# Testing
npm run jest            # Run unit tests
npm run test:coverage   # Coverage report
```

#### 12.2.3 Docker Build
```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build frontend
docker-compose build backend

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### 12.3 Deployment Process

#### 12.3.1 Deployment Steps

```
┌─────────────────────────────────────────────────────────────┐
│                    Deployment Process                        │
└─────────────────────────────────────────────────────────────┘

1. Pre-Deployment
   ├── Configure Environment Variables
   ├── Generate SSL Certificates
   ├── Set Server IP
   └── Review Configuration

2. Infrastructure Setup
   ├── Install Docker & Docker Compose
   ├── Configure Firewall Rules
   ├── Setup SSL/TLS Certificates
   └── Configure Nginx

3. Database Setup
   ├── PostgreSQL Installation
   ├── Database Creation
   ├── Run Migrations
   └── Initial Data Load

4. Keycloak Setup
   ├── Install Keycloak
   ├── Create Realm
   ├── Configure Clients
   ├── Create Users
   └── Configure Roles

5. Application Deployment
   ├── Clone Repository
   ├── Configure .env Files
   ├── Build Docker Images
   ├── Start Containers
   └── Verify Health Checks

6. Post-Deployment
   ├── Smoke Tests
   ├── Integration Tests
   ├── Performance Tests
   └── Monitoring Setup
```

#### 12.3.2 Quick Deployment (Docker Compose)
```bash
# 1. Set server IP
export SERVER_IP="10.157.150.207"

# 2. Generate SSL certificates
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Mastercard/CN=${SERVER_IP}"

# 3. Configure environment
cp vibe_backend/env.example vibe_backend/.env
cp vibe_frontend/env.local vibe_frontend/.env.local
sed -i.bak "s/localhost/${SERVER_IP}/g" vibe_backend/.env
sed -i.bak "s/localhost/${SERVER_IP}/g" vibe_frontend/.env.local

# 4. Deploy
docker-compose up -d

# 5. Verify
curl https://${SERVER_IP}/health
```

### 12.4 Environment Configuration

#### 12.4.1 Backend Environment Variables
```bash
# Server
NODE_ENV=production
PORT=3001
USE_HTTPS=false

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dyad

# Keycloak
KEYCLOAK_URL=https://10.157.147.235
KEYCLOAK_REALM=vibe-web
KEYCLOAK_CLIENT_ID=vibe-backend
KEYCLOAK_CLIENT_SECRET=<secret>
KEYCLOAK_REDIRECT_URI=https://10.157.150.207/api/auth/callback

# SSL (if HTTPS enabled)
SSL_KEY_PATH=./ssl/key.pem
SSL_CERT_PATH=./ssl/cert.pem

# Frontend URL
FRONTEND_URL=https://10.157.150.207

# AI Providers (optional)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
```

#### 12.4.2 Frontend Environment Variables
```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://10.157.150.207/api

# Keycloak
NEXT_PUBLIC_KEYCLOAK_URL=https://10.157.147.235
NEXT_PUBLIC_KEYCLOAK_REALM=vibe-web
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=vibe-mastercard-frontend

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

### 12.5 Continuous Integration/Deployment

#### 12.5.1 CI Pipeline (Conceptual)
```yaml
stages:
  - lint
  - test
  - build
  - deploy

lint:
  - Frontend: ESLint, Prettier
  - Backend: ESLint, Prettier
  - TypeScript: Type checking

test:
  - Frontend: Vitest unit tests, Playwright E2E
  - Backend: Jest unit tests
  - Integration tests

build:
  - Docker image builds
  - Tag with version
  - Push to registry

deploy:
  - Deploy to staging
  - Smoke tests
  - Deploy to production
  - Health check verification
```

---

## 13. Appendices

### 13.1 Glossary

| Term | Definition |
|------|------------|
| **API** | Application Programming Interface |
| **CORS** | Cross-Origin Resource Sharing |
| **CSP** | Content Security Policy |
| **JWT** | JSON Web Token |
| **OAuth2** | Open Authorization 2.0 framework |
| **OIDC** | OpenID Connect |
| **ORM** | Object-Relational Mapping |
| **RBAC** | Role-Based Access Control |
| **REST** | Representational State Transfer |
| **SSO** | Single Sign-On |
| **SSL/TLS** | Secure Sockets Layer / Transport Layer Security |
| **SSR** | Server-Side Rendering |
| **SSG** | Static Site Generation |
| **WSS** | WebSocket Secure |

### 13.2 Acronyms

| Acronym | Full Form |
|---------|-----------|
| **AI** | Artificial Intelligence |
| **API** | Application Programming Interface |
| **CD** | Continuous Deployment |
| **CI** | Continuous Integration |
| **CPU** | Central Processing Unit |
| **CRUD** | Create, Read, Update, Delete |
| **DNS** | Domain Name System |
| **HTTP** | Hypertext Transfer Protocol |
| **HTTPS** | Hypertext Transfer Protocol Secure |
| **IAM** | Identity and Access Management |
| **IDE** | Integrated Development Environment |
| **JSON** | JavaScript Object Notation |
| **LLM** | Large Language Model |
| **MFA** | Multi-Factor Authentication |
| **ORM** | Object-Relational Mapping |
| **RAM** | Random Access Memory |
| **RBAC** | Role-Based Access Control |
| **REST** | Representational State Transfer |
| **SQL** | Structured Query Language |
| **SSL** | Secure Sockets Layer |
| **SSO** | Single Sign-On |
| **TLS** | Transport Layer Security |
| **UI** | User Interface |
| **UX** | User Experience |
| **VM** | Virtual Machine |
| **XSS** | Cross-Site Scripting |

### 13.3 References

#### 13.3.1 External Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Express.js Documentation](https://expressjs.com)
- [Docker Documentation](https://docs.docker.com)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [Nginx Documentation](https://nginx.org/en/docs)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Anthropic API Reference](https://docs.anthropic.com)

#### 13.3.2 Project Documentation
- [README.md](README.md) - Project overview and quick start
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Detailed deployment instructions
- [KEYCLOAK_SETUP.md](KEYCLOAK_SETUP.md) - Keycloak configuration guide
- [QUICKSTART.md](QUICKSTART.md) - Quick start guide
- [GITHUB_INTEGRATION_GUIDE.md](GITHUB_INTEGRATION_GUIDE.md) - GitHub setup

### 13.4 Revision History

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-02-05 | Architecture Team | Initial SAD document |

### 13.5 Diagram Conventions

#### 13.5.1 Component Diagram Symbols
```
┌────────────┐
│ Component  │    - Software component/service
└────────────┘

┌────────────┐
│ <<Actor>>  │    - External actor/system
└────────────┘

─────────────>    - Data flow direction
        │         - Connection/relationship
       ▼          - Directional flow
```

#### 13.5.2 Architecture Views
This document uses multiple architectural views:
- **Logical View**: Component relationships and interactions
- **Process View**: Runtime behavior and communication
- **Development View**: Code organization and modules
- **Physical View**: Deployment and infrastructure
- **Scenarios**: Use cases and user interactions

### 13.6 Contact Information

For questions or clarifications regarding this architecture document:

- **Technical Architecture**: Architecture Team
- **Security Architecture**: Security Team
- **Infrastructure**: DevOps Team
- **Development**: Development Team

### 13.7 Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Chief Architect | | | |
| Lead Developer | | | |
| Security Officer | | | |
| Project Manager | | | |

---

**Document Status:** ✅ Approved  
**Next Review Date:** 2026-08-05  
**Document Owner:** Architecture Team

---

*This Software Architecture Document is a living document and should be updated as the system evolves. All changes should be reviewed and approved by the architecture team.*
