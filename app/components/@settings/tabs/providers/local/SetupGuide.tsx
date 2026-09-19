import React from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader } from '~/components/ui/Card';
import {
  Cpu,
  Server,
  Settings,
  ExternalLink,
  Package,
  Code,
  Database,
  CheckCircle,
  AlertCircle,
  Activity,
  Cable,
  ArrowLeft,
  Download,
  Shield,
  Globe,
  Terminal,
  Monitor,
  Wifi,
} from 'lucide-react';

import { LMStudioGuideSection } from './LMStudioGuideSection';
import { LocalAIGuideSection } from './LocalAIGuideSection';
import { PerformanceOptimizationSection } from './PerformanceOptimizationSection';

// Setup Guide Component
function SetupGuide({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="bg-transparent hover:bg-transparent text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-all duration-200 p-2"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">Local Provider Setup Guide</h2>
          <p className="text-sm text-bolt-elements-textSecondary">
            Complete setup instructions for running AI models locally
          </p>
        </div>
      </div>

      {/* Hardware Requirements Overview */}
      <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">System Requirements</h3>
              <p className="text-sm text-bolt-elements-textSecondary">Recommended hardware for optimal performance</p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-green-500" />
                <span className="font-medium text-bolt-elements-textPrimary">CPU</span>
              </div>
              <p className="text-bolt-elements-textSecondary">8+ cores, modern architecture</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-bolt-elements-textPrimary">RAM</span>
              </div>
              <p className="text-bolt-elements-textSecondary">16GB minimum, 32GB+ recommended</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-purple-500" />
                <span className="font-medium text-bolt-elements-textPrimary">GPU</span>
              </div>
              <p className="text-bolt-elements-textSecondary">NVIDIA RTX 30xx+ or AMD RX 6000+</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ollama Setup Section */}
      <Card className="bg-bolt-elements-background-depth-2 shadow-sm">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center ring-1 ring-purple-500/30">
              <Server className="w-6 h-6 text-purple-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-bolt-elements-textPrimary">Ollama Setup</h3>
              <p className="text-sm text-bolt-elements-textSecondary">
                Most popular choice for running open-source models locally with desktop app
              </p>
            </div>
            <span className="px-3 py-1 bg-purple-500/10 text-purple-500 text-xs font-medium rounded-full">
              Recommended
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Installation Options */}
          <div className="space-y-4">
            <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
              <Download className="w-4 h-4" />
              1. Choose Installation Method
            </h4>

            {/* Desktop App - New and Recommended */}
            <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Monitor className="w-5 h-5 text-green-500" />
                <h5 className="font-medium text-green-500">🆕 Desktop App (Recommended)</h5>
              </div>
              <p className="text-sm text-bolt-elements-textSecondary mb-3">
                New user-friendly desktop application with built-in model management and web interface.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-bolt-elements-background-depth-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Monitor className="w-4 h-4 text-bolt-elements-textPrimary" />
                    <strong className="text-bolt-elements-textPrimary">macOS</strong>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-gradient-to-r from-purple-500/10 to-purple-600/10 hover:from-purple-500/20 hover:to-purple-600/20 border-purple-500/30 hover:border-purple-500/50 transition-all duration-300 gap-2 group shadow-sm hover:shadow-lg hover:shadow-purple-500/20 font-medium"
                    _asChild
                  >
                    <a
                      href="https://ollama.com/download/mac"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 flex-shrink-0" />
                      <span className="flex-1 text-center font-medium">Download Desktop App</span>
                      <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 flex-shrink-0" />
                    </a>
                  </Button>
                </div>
                <div className="p-3 rounded-lg bg-bolt-elements-background-depth-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Monitor className="w-4 h-4 text-bolt-elements-textPrimary" />
                    <strong className="text-bolt-elements-textPrimary">Windows</strong>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-gradient-to-r from-purple-500/10 to-purple-600/10 hover:from-purple-500/20 hover:to-purple-600/20 border-purple-500/30 hover:border-purple-500/50 transition-all duration-300 gap-2 group shadow-sm hover:shadow-lg hover:shadow-purple-500/20 font-medium"
                    _asChild
                  >
                    <a
                      href="https://ollama.com/download/windows"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 flex-shrink-0" />
                      <span className="flex-1 text-center font-medium">Download Desktop App</span>
                      <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 flex-shrink-0" />
                    </a>
                  </Button>
                </div>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <span className="font-medium text-blue-500 text-sm">Built-in Web Interface</span>
                </div>
                <p className="text-xs text-bolt-elements-textSecondary">
                  Desktop app includes a web interface at{' '}
                  <code className="bg-bolt-elements-background-depth-4 px-1 rounded">http://localhost:11434</code>
                </p>
              </div>
            </div>

            {/* CLI Installation */}
            <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="w-5 h-5 text-bolt-elements-textPrimary" />
                <h5 className="font-medium text-bolt-elements-textPrimary">Command Line (Advanced)</h5>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-bolt-elements-background-depth-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Monitor className="w-4 h-4 text-bolt-elements-textPrimary" />
                    <strong className="text-bolt-elements-textPrimary">Windows</strong>
                  </div>
                  <div className="text-xs bg-bolt-elements-background-depth-4 p-2 rounded font-mono text-bolt-elements-textPrimary">
                    winget install Ollama.Ollama
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-bolt-elements-background-depth-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Monitor className="w-4 h-4 text-bolt-elements-textPrimary" />
                    <strong className="text-bolt-elements-textPrimary">macOS</strong>
                  </div>
                  <div className="text-xs bg-bolt-elements-background-depth-4 p-2 rounded font-mono text-bolt-elements-textPrimary">
                    brew install ollama
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-bolt-elements-background-depth-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="w-4 h-4 text-bolt-elements-textPrimary" />
                    <strong className="text-bolt-elements-textPrimary">Linux</strong>
                  </div>
                  <div className="text-xs bg-bolt-elements-background-depth-4 p-2 rounded font-mono text-bolt-elements-textPrimary">
                    curl -fsSL https://ollama.com/install.sh | sh
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Latest Model Recommendations */}
          <div className="space-y-4">
            <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
              <Package className="w-4 h-4" />
              2. Download Latest Models
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
                <h5 className="font-medium text-bolt-elements-textPrimary mb-3 flex items-center gap-2">
                  <Code className="w-4 h-4 text-green-500" />
                  Code & Development
                </h5>
                <div className="space-y-2 text-xs bg-bolt-elements-background-depth-4 p-3 rounded font-mono text-bolt-elements-textPrimary">
                  <div># Latest Llama 3.2 for coding</div>
                  <div>ollama pull llama3.2:3b</div>
                  <div>ollama pull codellama:13b</div>
                  <div>ollama pull deepseek-coder-v2</div>
                  <div>ollama pull qwen2.5-coder:7b</div>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-bolt-elements-background-depth-3">
                <h5 className="font-medium text-bolt-elements-textPrimary mb-3 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-500" />
                  General Purpose & Chat
                </h5>
                <div className="space-y-2 text-xs bg-bolt-elements-background-depth-4 p-3 rounded font-mono text-bolt-elements-textPrimary">
                  <div># Latest general models</div>
                  <div>ollama pull llama3.2:3b</div>
                  <div>ollama pull mistral:7b</div>
                  <div>ollama pull phi3.5:3.8b</div>
                  <div>ollama pull qwen2.5:7b</div>
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-purple-500" />
                  <span className="font-medium text-purple-500">Performance Optimized</span>
                </div>
                <ul className="text-xs text-bolt-elements-textSecondary space-y-1">
                  <li>• Llama 3.2: 3B - Fastest, 8GB RAM</li>
                  <li>• Phi-3.5: 3.8B - Great balance</li>
                  <li>• Qwen2.5: 7B - Excellent quality</li>
                  <li>• Mistral: 7B - Popular choice</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium text-yellow-500">Pro Tips</span>
                </div>
                <ul className="text-xs text-bolt-elements-textSecondary space-y-1">
                  <li>• Start with 3B-7B models for best performance</li>
                  <li>• Use quantized versions for faster loading</li>
                  <li>• Desktop app auto-manages model storage</li>
                  <li>• Web UI available at localhost:11434</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Desktop App Features */}
          <div className="space-y-4">
            <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              3. Desktop App Features
            </h4>
            <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h5 className="font-medium text-blue-500 mb-3">🖥️ User Interface</h5>
                  <ul className="text-sm text-bolt-elements-textSecondary space-y-1">
                    <li>• Model library browser</li>
                    <li>• One-click model downloads</li>
                    <li>• Built-in chat interface</li>
                    <li>• System resource monitoring</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-blue-500 mb-3">🔧 Management Tools</h5>
                  <ul className="text-sm text-bolt-elements-textSecondary space-y-1">
                    <li>• Automatic updates</li>
                    <li>• Model size optimization</li>
                    <li>• GPU acceleration detection</li>
                    <li>• Cross-platform compatibility</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="space-y-4">
            <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
              <Settings className="w-4 h-4" />
              4. Troubleshooting & Commands
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                <h5 className="font-medium text-red-500 mb-2">Common Issues</h5>
                <ul className="text-xs text-bolt-elements-textSecondary space-y-1">
                  <li>• Desktop app not starting: Restart system</li>
                  <li>• GPU not detected: Update drivers</li>
                  <li>• Port 11434 blocked: Change port in settings</li>
                  <li>• Models not loading: Check available disk space</li>
                  <li>• Slow performance: Use smaller models or enable GPU</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <h5 className="font-medium text-green-500 mb-2">Useful Commands</h5>
                <div className="text-xs bg-bolt-elements-background-depth-4 p-3 rounded font-mono text-bolt-elements-textPrimary space-y-1">
                  <div># Check installed models</div>
                  <div>ollama list</div>
                  <div></div>
                  <div># Remove unused models</div>
                  <div>ollama rm model_name</div>
                  <div></div>
                  <div># Check GPU usage</div>
                  <div>ollama ps</div>
                  <div></div>
                  <div># View logs</div>
                  <div>ollama logs</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LM Studio Setup Section */}
      <LMStudioGuideSection />

      {/* LocalAI Setup Section */}
      <LocalAIGuideSection />

      {/* Performance Optimization */}
      <PerformanceOptimizationSection />

      {/* Alternative Options */}
      <Card className="bg-bolt-elements-background-depth-2 shadow-sm">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center ring-1 ring-orange-500/30">
              <Wifi className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-bolt-elements-textPrimary">Alternative Options</h3>
              <p className="text-sm text-bolt-elements-textSecondary">
                Other local AI solutions and cloud alternatives
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-bolt-elements-textPrimary">Other Local Solutions</h4>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-bolt-elements-background-depth-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-bolt-elements-textPrimary">Jan.ai</span>
                  </div>
                  <p className="text-xs text-bolt-elements-textSecondary">
                    Modern interface with built-in model marketplace
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-bolt-elements-background-depth-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Terminal className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-bolt-elements-textPrimary">Oobabooga</span>
                  </div>
                  <p className="text-xs text-bolt-elements-textSecondary">
                    Advanced text generation web UI with extensions
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-bolt-elements-background-depth-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Cable className="w-4 h-4 text-purple-500" />
                    <span className="font-medium text-bolt-elements-textPrimary">KoboldAI</span>
                  </div>
                  <p className="text-xs text-bolt-elements-textSecondary">Focus on creative writing and storytelling</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium text-bolt-elements-textPrimary">Cloud Alternatives</h4>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-bolt-elements-background-depth-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-orange-500" />
                    <span className="font-medium text-bolt-elements-textPrimary">OpenRouter</span>
                  </div>
                  <p className="text-xs text-bolt-elements-textSecondary">Access to 100+ models through unified API</p>
                </div>
                <div className="p-3 rounded-lg bg-bolt-elements-background-depth-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Server className="w-4 h-4 text-red-500" />
                    <span className="font-medium text-bolt-elements-textPrimary">Together AI</span>
                  </div>
                  <p className="text-xs text-bolt-elements-textSecondary">Fast inference with open-source models</p>
                </div>
                <div className="p-3 rounded-lg bg-bolt-elements-background-depth-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-pink-500" />
                    <span className="font-medium text-bolt-elements-textPrimary">Groq</span>
                  </div>
                  <p className="text-xs text-bolt-elements-textSecondary">Ultra-fast LPU inference for Llama models</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SetupGuide;
