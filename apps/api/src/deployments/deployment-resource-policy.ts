import { shellQuote } from './deployment-release-commands.js';

const integerSetting = (
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
};

export const deploymentBuildHeapMb = (value: string | undefined): number =>
  integerSetting(value, 768, 256, 8192);

export const deploymentMinimumAvailableMb = (value: string | undefined): number =>
  integerSetting(value, 1536, 512, 32768);

export function deploymentResourceCheckCommand(minimumAvailableMb: number): string {
  const minimumKb = minimumAvailableMb * 1024;
  return `awk -v minimum_kb=${minimumKb} '/^MemAvailable:/ { memory_kb=$2 } /^SwapFree:/ { swap_kb=$2 } END { available_kb=memory_kb+swap_kb; printf "可用内存 %.0f MB（物理 %.0f MB，Swap %.0f MB）\\n", available_kb/1024, memory_kb/1024, swap_kb/1024; if (available_kb < minimum_kb) { printf "部署资源不足：至少需要 ${minimumAvailableMb} MB 可用内存（含 Swap）\\n" > "/dev/stderr"; exit 1 } }' /proc/meminfo`;
}

export function deploymentBuildCommand(command: string, maximumHeapMb: number): string {
  return `env NODE_OPTIONS=${shellQuote(`--max-old-space-size=${maximumHeapMb}`)} sh -c ${shellQuote(command)}`;
}
