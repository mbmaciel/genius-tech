import derivAPI from "./derivApi";

let keepAliveInterval: NodeJS.Timeout | null = null;
const KEEP_ALIVE_INTERVAL = 30000; // 30 seconds

/**
 * Start the WebSocket keep-alive mechanism
 * This will send a ping every 30 seconds to keep the connection alive
 */
export function startKeepAlive(): void {
  // Clear any existing interval first
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
  // Set up new interval
  keepAliveInterval = setInterval(async () => {
    try {
      // Check if connected first
      if (!derivAPI.getConnectionStatus()) {
        console.log('WebSocket not connected, attempting to reconnect...');
        await derivAPI.connect();
        return;
      }
      
      // Send ping to keep connection alive
      const pingSuccess = await derivAPI.ping();
      
      if (!pingSuccess) {
        console.warn('Keep-alive ping failed, reconnecting...');
        await derivAPI.connect();
      }
    } catch (error) {
      console.error('Error in keep-alive mechanism:', error);
    }
  }, KEEP_ALIVE_INTERVAL);
  
  console.log('WebSocket keep-alive mechanism started');
}

/**
 * Stop the WebSocket keep-alive mechanism
 */
export function stopKeepAlive(): void {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('WebSocket keep-alive mechanism stopped');
  }
}
