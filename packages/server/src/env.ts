export function readPort(value: string | undefined): number {
  if (value === undefined) {
    return 8080;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new RangeError('PORT must be an integer between 0 and 65535.');
  }

  return port;
}

export function readHost(value: string | undefined): string {
  return value?.trim() || '127.0.0.1';
}
