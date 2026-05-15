type ImportMetaEnvLike = {
  DEV?: boolean;
  MODE?: string;
  VITE_AWATIF_PROFILE?: string;
};

function importMetaEnv(): ImportMetaEnvLike | undefined {
  return (import.meta as ImportMeta & { env?: ImportMetaEnvLike }).env;
}

/** Opt-in: `AWATIF_PROFILE=1` (Node/Vitest), `.env` `VITE_AWATIF_PROFILE=1`, or Vite dev (not Vitest `MODE=test`). */
export function isLinearSolverProfilingEnabled(): boolean {
  if (typeof process !== "undefined" && process.env) {
    const v = process.env.AWATIF_PROFILE;
    if (v === "1" || v === "true") return true;
  }
  const env = importMetaEnv();
  if (env?.VITE_AWATIF_PROFILE === "1" || env?.VITE_AWATIF_PROFILE === "true")
    return true;
  if (env?.DEV === true && env?.MODE !== "test") return true;
  return false;
}

export function heapUsedBytes(): number | undefined {
  if (typeof process !== "undefined" && typeof process.memoryUsage === "function") {
    return process.memoryUsage().heapUsed;
  }
  const perf = globalThis.performance as Performance & {
    memory?: { usedJSHeapSize: number };
  };
  return perf.memory?.usedJSHeapSize;
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n)) return "? B";
  const abs = Math.abs(n);
  if (abs >= 1 << 30) return `${(n / (1 << 30)).toFixed(2)} GiB`;
  if (abs >= 1 << 20) return `${(n / (1 << 20)).toFixed(2)} MiB`;
  if (abs >= 1 << 10) return `${(n / (1 << 10)).toFixed(2)} KiB`;
  return `${Math.round(n)} B`;
}

/** Lower bound for IEEE-754 number payload only; real `number[][]` uses far more heap. */
export function denseStiffnessMinBytes(dof: number): number {
  return dof * dof * 8;
}

export function logLinearSolverProfile(
  prefix: string,
  detail: Record<string, string | number | boolean | undefined>,
): void {
  if (!isLinearSolverProfilingEnabled()) return;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(detail)) {
    if (v === undefined) continue;
    if (typeof v === "number" && !Number.isInteger(v))
      parts.push(`${k}=${v.toFixed(3)}`);
    else parts.push(`${k}=${String(v)}`);
  }
  console.info(`[awatif/solver] ${prefix} | ${parts.join(" | ")}`);
}
