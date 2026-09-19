# Welcome to PocketApp

**PocketApp** is an open-source AI software studio for building real, full-stack web applications. Unlike traditional AI generators that stop at static frontends with mock data, PocketApp builds complete applications backed by an embedded **PocketBase** database (SQLite), instant in-browser execution, and clean 1-click exports.

---

## ⚡ Core Features

- 🗄️ **Real Database & Collections**: Automatically creates collections, fields, relations, and access rules in PocketBase.
- 🔐 **Authentication Out of the Box**: Integrated user signup, login, session management, and auth tokens.
- ⚡ **In-Browser Execution**: Uses WebContainer virtualization to boot a live Node.js runtime, terminal, and hot-reloading dev server in the browser.
- 🔑 **Bring Your Own Key (BYOK)**: 100% client-side key storage in `localStorage`. Zero server storage of your keys. Zero required signup.
- 📦 **1-Click Full-Stack Export**: Download complete source code with frontend, PocketBase schemas, and a standalone `docker-compose.yml` to run anywhere.
- 🛠️ **AI Error Auto-Fix**: Automatically detects build or runtime errors in the terminal and fixes them with a single click.
- 🐙 **Git & GitHub Integration**: Push repositories directly to GitHub or deploy to Vercel/Netlify.
- 🧩 **MCP Support**: Model Context Protocol integration for connecting external tools and APIs.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version `>= 18.18.0`)
- [pnpm](https://pnpm.io/) (`npm i -g pnpm`)
- [Docker](https://www.docker.com/) (to run the local PocketBase database)

### Step 1: Clone the Repository

```bash
git clone https://github.com/simo48hour/pocketapp.git
cd pocketapp
```

### Step 2: Install Dependencies

```bash
pnpm install
```

### Step 3: Start Local PocketBase Database

```bash
docker compose up -d
```

PocketBase Admin UI will be available at: **http://127.0.0.1:8090/_/**

### Step 4: Run Development Server

```bash
pnpm run dev
```

Open **http://localhost:5173** in your browser.

---

## 🔑 AI Model Configuration (BYOK)

PocketApp does not require sign-up or accounts for self-hosting. All API keys remain on your machine in browser `localStorage`.

### Configuring Keys in the UI

1. Click the **🔑 API Keys** button in the header.
2. Select your provider (e.g. Anthropic, OpenAI, Google, Groq, DeepSeek, Ollama, LM Studio).
3. Paste your API key and click **Save**.

### Supported Providers

| Provider | Recommended Model | Use Case |
|---|---|---|
| **Anthropic** | Claude 3.7 Sonnet / Claude 3.5 Sonnet | Best overall full-stack coder |
| **Google** | Gemini 2.0 Flash / Pro | Ultra-fast generation, huge context |
| **OpenAI** | GPT-4o | Solid general coding & reasoning |
| **Groq** | Llama 3.3 70B | Ultra low-latency responses |
| **DeepSeek** | DeepSeek V3 / Coder | Powerful open-weights coding |
| **Ollama / LM Studio** | Qwen 2.5 Coder 32b | Completely local & offline inference |

---

## 🐳 Docker Deployment

### Production Docker Build

```bash
docker build --target pocketapp-production -t pocketapp:production .
docker run -p 5173:5173 --env-file .env.local pocketapp:production
```

### Docker Compose

```bash
docker compose --profile production up -d
```

---

## 🗄️ PocketBase Integration

Generated applications connect to PocketBase using the official client library:

```typescript
import PocketBase from 'pocketbase';

export const pb = new PocketBase(
  import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'
);
```

When you export a project, PocketApp packages:
1. All application source code (React, Vite, Tailwind, etc.)
2. PocketBase schema definitions (`pb_schema.json`)
3. A standalone `docker-compose.yml` to launch both frontend and backend anywhere with a single command.

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `pnpm run dev` | Start development server with live reload |
| `pnpm run build` | Build production assets |
| `pnpm run start` | Start production server with Wrangler / Workerd |
| `pnpm run test` | Run unit tests with Vitest |
| `pnpm run typecheck` | Run TypeScript type checking |
| `pnpm run lint` | Run ESLint across codebase |

---

## 🤝 Community & Support

- **Repository**: [simo48hour/pocketapp](https://github.com/simo48hour/pocketapp)
- **Issues & Bug Reports**: [GitHub Issues](https://github.com/simo48hour/pocketapp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/simo48hour/pocketapp/discussions)
