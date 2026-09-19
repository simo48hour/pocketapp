import { json, type MetaFunction } from '@remix-run/cloudflare';
import Demo from '~/components/ui/ai-chat-input/demo';

export const meta: MetaFunction = () => {
  return [{ title: 'AI Chat Input Demo - PocketApp' }];
};

export const loader = () => json({});

export default function DemoPage() {
  return <Demo />;
}
