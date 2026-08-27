export const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;

export function deploymentReleaseCommand(releasePath: string, command: string): string {
  return `cd ${shellQuote(releasePath)} && set -a && . ./.env && set +a && ${command}`;
}

export function atomicReleaseSwitchCommand(deployPath: string, releasePath: string): string {
  const next = `${deployPath}/.current-next`;
  return `ln -sfn ${shellQuote(releasePath)} ${shellQuote(next)} && mv -Tf ${shellQuote(next)} ${shellQuote(`${deployPath}/current`)}`;
}

export function deploymentHealthCheckCommand(url: string): string {
  return `for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS --max-time 5 ${shellQuote(url)} >/dev/null && exit 0; sleep 3; done; exit 1`;
}
