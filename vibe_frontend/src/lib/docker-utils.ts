/**
 * Helper function to extract and set port/URL from Docker response
 * Waits for the Docker status to be ready and sets the app URL
 *
 * @param port - The port number from Docker status
 * @param appId - The application ID
 * @param dockerStatus - Docker status object with isReady and isRunning flags
 * @param setAppUrlObj - Setter function for the app URL atom
 */
export function setupDockerUrlFromStatus(
  port: number,
  appId: number,
  dockerStatus: any,
  setAppUrlObj: (value: any) => void,
) {
  if (
    port > 0 &&
    port < 65536 &&
    dockerStatus?.isReady &&
    dockerStatus?.isRunning
  ) {
    const dockerUrl = `http://localhost:${port}`;
    setAppUrlObj({
      appUrl: dockerUrl,
      appId: appId,
      originalUrl: dockerUrl,
    });
  }
}

/**
 * Extracts a valid port number from Docker response
 * Strips any non-numeric characters and validates range
 *
 * @param portValue - Port value from Docker API (could be string or number)
 * @returns Valid port number or 0 if invalid
 */
export function extractValidPort(portValue: any): number {
  const port = Number(String(portValue).replace(/[^0-9]/g, ""));
  return port > 0 && port < 65536 ? port : 0;
}
