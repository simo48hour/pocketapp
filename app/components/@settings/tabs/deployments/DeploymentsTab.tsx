import React from 'react';

export const DeploymentsTab: React.FC = () => {
  return (
    <div className="space-y-6 text-zinc-100">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Deploy & Self-Host</h2>
        <p className="mt-1 text-sm text-zinc-400">
          PocketApp is designed to be fully exportable and self-hostable with zero vendor lock-in.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Option 1: Docker Compose */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <div className="i-ph:cube w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Docker Compose</h3>
              <span className="text-[11px] text-zinc-400">Recommended for self-hosting</span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            Run the pre-configured PocketBase container locally or on any cloud VPS (Hetzner, DigitalOcean, AWS, Linode).
          </p>
          <pre className="p-3 rounded-lg bg-zinc-950 text-[11px] font-mono text-zinc-300 overflow-x-auto border border-zinc-800">
            <code>docker compose up -d</code>
          </pre>
        </div>

        {/* Option 2: Full-Stack Export */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <div className="i-ph:download-simple w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Export Project</h3>
              <span className="text-[11px] text-zinc-400">Full source code & SQLite DB</span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            Click &quot;Export App&quot; in the header bar to download a zip containing your React frontend,
            PocketBase migrations, and hooks.
          </p>
          <div className="text-xs text-emerald-400/90 font-medium">
            ✓ 100% portable and ready for git
          </div>
        </div>

        {/* Option 3: Git Deployments */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <div className="i-ph:git-branch w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">GitHub & GitLab</h3>
              <span className="text-[11px] text-zinc-400">Direct repository sync</span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            Connect your personal GitHub or GitLab token in Settings to push code directly to your own repositories.
          </p>
          <div className="text-xs text-purple-400/90 font-medium">
            ✓ Automated push and version control
          </div>
        </div>

        {/* Option 4: Static Hosting */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <div className="i-ph:cloud-arrow-up w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Vercel & Netlify</h3>
              <span className="text-[11px] text-zinc-400">Frontend cloud deployment</span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            Connect your Vercel or Netlify accounts in Settings to deploy the frontend bundle with automatic SSL and CDN.
          </p>
          <div className="text-xs text-amber-400/90 font-medium">
            ✓ 1-click frontend builds
          </div>
        </div>
      </div>
    </div>
  );
};
