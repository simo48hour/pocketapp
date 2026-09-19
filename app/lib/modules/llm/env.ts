let globalEnv: Record<string, string> = {};

export function setLLMEnv(env: Record<string, string>) {
  if (env && Object.keys(env).length > 0) {
    globalEnv = { ...globalEnv, ...env };
  }
}

export function getLLMEnv(): Record<string, string> {
  return globalEnv;
}
