# 🚀 Changelog

All notable changes to PocketApp are documented in this file.

## [v1.0.0] - Initial Open-Source Release

### 🌟 Key Features

- **Embedded PocketBase Database Engine**:
  - Embedded SQLite/PocketBase database runtime integrated into local development and export workflows.
  - Automatic collection creation, schema management, and real-time event subscription capability.
  - Pre-wired auth support (email/password, OAuth) in generated templates.

- **Bring Your Own Key (BYOK)**:
  - 100% client-side API key configuration stored securely in browser `localStorage`.
  - No server-side storage or proxy leakage of user keys.
  - Zero signup requirement for local self-hosted and open-source usage.
  - Support for Anthropic (Claude 3.7 Sonnet, Claude 3.5 Sonnet), OpenAI (GPT-4o), Google Gemini (Gemini 2.0 Flash, Pro), Groq, DeepSeek, Ollama, and LM Studio.

- **In-Browser Execution & Live Sandbox**:
  - Real-time Node.js execution environment powered by WebContainer virtualization.
  - In-browser bash terminal and dev server running directly inside modern browsers.
  - Hot Module Replacement (HMR) and real-time live preview.

- **Full-Stack 1-Click Export**:
  - Export complete projects as a standalone ZIP including frontend code, PocketBase schemas, seed data, and a portable `docker-compose.yml`.

- **Enhanced Developer Tooling**:
  - Automatic error detection and AI one-click bug fixing.
  - Multi-file code generation and editing.
  - Integrated Git version control and GitHub deployment.
