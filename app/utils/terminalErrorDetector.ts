export function createTerminalErrorDetector() {
  let outputBuffer = '';
  let errorCheckTimeout: any = null;

  const detect = (data: string) => {
    outputBuffer += data;

    if (outputBuffer.length > 25000) {
      outputBuffer = outputBuffer.slice(-12000);
    }

    if (errorCheckTimeout) {
      clearTimeout(errorCheckTimeout);
    }

    errorCheckTimeout = setTimeout(() => {
      import('~/utils/terminalErrorParser')
        .then(({ extractErrorFromTerminal }) => {
          const { hasError, summary, snippet } = extractErrorFromTerminal(outputBuffer);

          if (hasError && snippet) {
            import('~/lib/stores/workbench')
              .then(({ workbenchStore }) => {
                workbenchStore.setTerminalError(snippet, summary);
              })
              .catch(() => {
                /* Stream shutdown or optional diagnostics. */
              });
          }
        })
        .catch(() => {
          /* Stream shutdown or optional diagnostics. */
        });
    }, 750);
  };

  return Object.assign(detect, {
    dispose() {
      clearTimeout(errorCheckTimeout);
      outputBuffer = '';
    },
  });
}
