import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { FileMap } from '~/lib/stores/files';

export async function exportFullStackProject(
  projectTitle: string,
  files: FileMap
) {
  const zip = new JSZip();
  let hasSchema = false;

  // 1. Add all project frontend source files
  Object.entries(files).forEach(([filePath, fileEntry]) => {
    if (fileEntry && fileEntry.type === 'file' && typeof fileEntry.content === 'string') {
      const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      if (cleanPath === 'pb_schema.json') {
        hasSchema = true;
      }
      zip.file(cleanPath, fileEntry.content);
    }
  });

  // 2. If no pb_schema.json was generated yet, provide a baseline one
  if (!hasSchema) {
    const defaultSchema = [
      {
        name: 'posts',
        type: 'base',
        schema: [
          { name: 'title', type: 'text', required: true },
          { name: 'content', type: 'text', required: false },
          { name: 'published', type: 'bool' }
        ],
        listRule: '',
        viewRule: '',
        createRule: "@request.auth.id != ''",
        updateRule: '@request.auth.id = user.id',
        deleteRule: '@request.auth.id = user.id'
      }
    ];
    zip.file('pb_schema.json', JSON.stringify(defaultSchema, null, 2));
  }

  // 3. Add standalone Docker Compose for PocketBase
  const dockerComposeYaml = `services:
  pocketbase:
    image: ghcr.io/muchobien/pocketbase:latest
    container_name: \${COMPOSE_PROJECT_NAME:-app}-pb
    restart: unless-stopped
    ports:
      - "8090:8090"
    volumes:
      - pb_data:/pb/pb_data
      - ./pb_schema.json:/pb/pb_schema.json:ro
    command:
      - serve
      - --http=0.0.0.0:8090
      - --dir=/pb/pb_data

volumes:
  pb_data:
`;
  zip.file('docker-compose.yml', dockerComposeYaml);

  // 4. Add setup instructions
  const readmeMd = `# ${projectTitle || 'PocketApp Project'} - Full-Stack Export

This application was exported from the PocketApp platform.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS
- **Database/Auth**: PocketBase (runs on \`http://127.0.0.1:8090\`)

## Getting Started

### Method 1: Run with Docker Compose (Recommended)
1. Start the PocketBase database container:
   \`\`\`bash
   docker compose up -d
   \`\`\`
   Access the PocketBase Admin UI at: **http://127.0.0.1:8090/_/**

2. Start the React frontend:
   \`\`\`bash
   npm install
   npm run dev
   \`\`\`
   Access the web application at: **http://localhost:5173**

### Method 2: Run Standalone Executable
1. Download the PocketBase binary for your OS from [https://pocketbase.io/docs/](https://pocketbase.io/docs/)
2. Run PocketBase in this folder:
   \`\`\`bash
   ./pocketbase serve
   \`\`\`
3. In a separate terminal, start the frontend:
   \`\`\`bash
   npm install
   npm run dev
   \`\`\`
`;
  zip.file('EXPORT_README.md', readmeMd);

  // 5. Generate and download zip
  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = `${(projectTitle || 'pocketapp-project').toLowerCase().replace(/[^a-z0-9_-]/g, '-')}-fullstack.zip`;
  saveAs(blob, filename);
}
