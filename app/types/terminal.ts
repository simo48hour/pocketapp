export interface ITerminal {
  readonly cols?: number;
  readonly rows?: number;

  reset: () => void;
  write: (data: string, callback?: () => void) => void;
  onData: (cb: (data: string) => void) => { dispose: () => void };
  input: (data: string) => void;
}
