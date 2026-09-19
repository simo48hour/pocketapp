import React from 'react';
import type { ActionAlert, SupabaseAlert, DeployAlert, LlmErrorAlertType } from '~/types/actions';
import DeployChatAlert from '~/components/deploy/DeployAlert';
import ChatAlert from './ChatAlert';
import { SupabaseChatAlert } from '~/components/chat/SupabaseAlert';
import LlmErrorAlert from './LLMApiAlert';

interface ChatAlertsProps {
  deployAlert?: DeployAlert;
  clearDeployAlert?: () => void;
  supabaseAlert?: SupabaseAlert;
  clearSupabaseAlert?: () => void;
  actionAlert?: ActionAlert;
  clearAlert?: () => void;
  llmErrorAlert?: LlmErrorAlertType;
  clearLlmErrorAlert?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
}

export const ChatAlerts: React.FC<ChatAlertsProps> = ({
  deployAlert,
  clearDeployAlert,
  supabaseAlert,
  clearSupabaseAlert,
  actionAlert,
  clearAlert,
  llmErrorAlert,
  clearLlmErrorAlert,
  sendMessage,
}) => {
  return (
    <div className="flex flex-col gap-2">
      {deployAlert && (
        <DeployChatAlert
          alert={deployAlert}
          clearAlert={() => clearDeployAlert?.()}
          postMessage={(message: string | undefined) => {
            sendMessage?.({} as any, message);
            clearSupabaseAlert?.();
          }}
        />
      )}
      {supabaseAlert && (
        <SupabaseChatAlert
          alert={supabaseAlert}
          clearAlert={() => clearSupabaseAlert?.()}
          postMessage={(message) => {
            sendMessage?.({} as any, message);
            clearSupabaseAlert?.();
          }}
        />
      )}
      {actionAlert && (
        <ChatAlert
          alert={actionAlert}
          clearAlert={() => clearAlert?.()}
          postMessage={(message) => {
            sendMessage?.({} as any, message);
            clearAlert?.();
          }}
        />
      )}
      {llmErrorAlert && <LlmErrorAlert alert={llmErrorAlert} clearAlert={() => clearLlmErrorAlert?.()} />}
    </div>
  );
};
