import React from 'react';
import { Card, CardContent, CardHeader } from '~/components/ui/Card';
import {
  Settings,
  CheckCircle,
  Download,
  Globe,
} from 'lucide-react';

export function LocalAIGuideSection() {
  return (
    <Card className="bg-bolt-elements-background-depth-2 shadow-sm">
      <CardHeader className="pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center ring-1 ring-green-500/30">
            <Globe className="w-6 h-6 text-green-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-bolt-elements-textPrimary">LocalAI Setup</h3>
            <p className="text-sm text-bolt-elements-textSecondary">
              Self-hosted OpenAI-compatible API server with extensive model support
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Installation */}
        <div className="space-y-4">
          <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Installation Options
          </h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
              <h5 className="font-medium text-bolt-elements-textPrimary mb-2">Quick Install</h5>
              <div className="text-xs bg-bolt-elements-background-depth-4 p-3 rounded font-mono text-bolt-elements-textPrimary space-y-1">
                <div># One-line install</div>
                <div>curl https://localai.io/install.sh | sh</div>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
              <h5 className="font-medium text-bolt-elements-textPrimary mb-2">Docker (Recommended)</h5>
              <div className="text-xs bg-bolt-elements-background-depth-4 p-3 rounded font-mono text-bolt-elements-textPrimary space-y-1">
                <div>docker run -p 8080:8080</div>
                <div>quay.io/go-skynet/local-ai:latest</div>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div className="space-y-4">
          <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuration
          </h4>
          <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
            <p className="text-sm text-bolt-elements-textSecondary mb-3">
              LocalAI supports many model formats and provides a full OpenAI-compatible API.
            </p>
            <div className="text-xs bg-bolt-elements-background-depth-4 p-3 rounded font-mono text-bolt-elements-textPrimary space-y-1">
              <div># Example configuration</div>
              <div>models:</div>
              <div>- name: llama3.1</div>
              <div>backend: llama</div>
              <div>parameters:</div>
              <div>model: llama3.1.gguf</div>
            </div>
          </div>
        </div>

        {/* Advantages */}
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="font-medium text-green-500">LocalAI Advantages</span>
          </div>
          <ul className="text-xs text-bolt-elements-textSecondary space-y-1 list-disc list-inside">
            <li>Full OpenAI API compatibility</li>
            <li>Supports multiple model formats</li>
            <li>Docker deployment option</li>
            <li>Built-in model gallery</li>
            <li>REST API for model management</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
