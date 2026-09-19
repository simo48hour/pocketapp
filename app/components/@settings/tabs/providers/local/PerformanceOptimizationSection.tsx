import React from 'react';
import { Card, CardContent, CardHeader } from '~/components/ui/Card';
import { Activity, CheckCircle } from 'lucide-react';

export function PerformanceOptimizationSection() {
  return (
    <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Performance Optimization</h3>
            <p className="text-sm text-bolt-elements-textSecondary">Tips to improve local AI performance</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="font-medium text-bolt-elements-textPrimary">Hardware Optimizations</h4>
            <ul className="text-sm text-bolt-elements-textSecondary space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Use NVIDIA GPU with CUDA for 5-10x speedup</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Increase RAM for larger context windows</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Use SSD storage for faster model loading</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Close other applications to free up RAM</span>
              </li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-bolt-elements-textPrimary">Software Optimizations</h4>
            <ul className="text-sm text-bolt-elements-textSecondary space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>Use smaller models for faster responses</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>Enable quantization (4-bit, 8-bit models)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>Reduce context length for chat applications</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>Use streaming responses for better UX</span>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
