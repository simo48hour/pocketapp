import React from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader } from '~/components/ui/Card';
import {
  Settings,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Download,
  Monitor,
} from 'lucide-react';

export function LMStudioGuideSection() {
  return (
    <Card className="bg-bolt-elements-background-depth-2 shadow-sm">
      <CardHeader className="pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center ring-1 ring-blue-500/30">
            <Monitor className="w-6 h-6 text-blue-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-bolt-elements-textPrimary">LM Studio Setup</h3>
            <p className="text-sm text-bolt-elements-textSecondary">
              User-friendly GUI for running local models with excellent model management
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Installation */}
        <div className="space-y-4">
          <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
            <Download className="w-4 h-4" />
            1. Download & Install
          </h4>
          <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
            <p className="text-sm text-bolt-elements-textSecondary mb-3">
              Download LM Studio for Windows, macOS, or Linux from the official website.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 hover:from-blue-500/20 hover:to-blue-600/20 border-blue-500/30 hover:border-blue-500/50 transition-all duration-300 gap-2 group shadow-sm hover:shadow-lg hover:shadow-blue-500/20 font-medium"
              _asChild
            >
              <a
                href="https://lmstudio.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 flex-shrink-0" />
                <span className="flex-1 text-center font-medium">Download LM Studio</span>
                <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 flex-shrink-0" />
              </a>
            </Button>
          </div>
        </div>

        {/* Configuration */}
        <div className="space-y-4">
          <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
            <Settings className="w-4 h-4" />
            2. Configure Local Server
          </h4>
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
              <h5 className="font-medium text-bolt-elements-textPrimary mb-2">Start Local Server</h5>
              <ol className="text-xs text-bolt-elements-textSecondary space-y-1 list-decimal list-inside">
                <li>Download a model from the "My Models" tab</li>
                <li>Go to "Local Server" tab</li>
                <li>Select your downloaded model</li>
                <li>Set port to 1234 (default)</li>
                <li>Click "Start Server"</li>
              </ol>
            </div>

            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="font-medium text-red-500">Critical: Enable CORS</span>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-bolt-elements-textSecondary">
                  To work with PocketApp, you MUST enable CORS in LM Studio:
                </p>
                <ol className="text-xs text-bolt-elements-textSecondary space-y-1 list-decimal list-inside ml-2">
                  <li>In Server Settings, check "Enable CORS"</li>
                  <li>Set Network Interface to "0.0.0.0" for external access</li>
                  <li>
                    Alternatively, use CLI:{' '}
                    <code className="bg-bolt-elements-background-depth-4 px-1 rounded">lms server start --cors</code>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Advantages */}
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-blue-500">LM Studio Advantages</span>
          </div>
          <ul className="text-xs text-bolt-elements-textSecondary space-y-1 list-disc list-inside">
            <li>Built-in model downloader with search</li>
            <li>Easy model switching and management</li>
            <li>Built-in chat interface for testing</li>
            <li>GGUF format support (most compatible)</li>
            <li>Regular updates with new features</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
