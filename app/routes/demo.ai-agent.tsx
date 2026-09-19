import ThinkingStateDemo from "~/components/ui/demo";
import type { MetaFunction } from "@remix-run/cloudflare";

export const meta: MetaFunction = () => {
  return [
    { title: "AI Agent Response - Interactive Demo" },
    { name: "description", content: "Interactive visualization for AI agent thinking, reasoning, and tool execution traces." },
  ];
};

export default function DemoAiAgentRoute() {
  return <ThinkingStateDemo />;
}
