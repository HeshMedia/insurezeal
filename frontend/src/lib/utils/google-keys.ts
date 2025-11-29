/**
 * Google Sheets Private Key handling utilities for frontend
 * Similar to backend implementation but using browser-compatible base64 decoding
 */

/**
 * Get Google Sheets private key, supporting both regular and Base64 formats
 * @returns Decoded private key string
 */
export function getGoogleSheetsPrivateKey(): string {
  try {
    // Check both variables
    // The backend checks GOOGLE_SHEETS_PRIVATE_KEY_BASE64 first, then GOOGLE_SHEETS_PRIVATE_KEY
    // We'll check our standard frontend vars
    let rawKey = process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;
    
    if (!rawKey) {
      console.error('No Google Sheets private key found in environment variables');
      return '';
    }

    // Clean up the raw key first - remove outer quotes if present
    rawKey = rawKey.trim();
    if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || 
        (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
      rawKey = rawKey.substring(1, rawKey.length - 1);
    }

    // Backend-style logic: Try to decode as base64 first
    // The user's base64 string starts with "LS0t...", which decodes to "-----..."
    // We need to be careful not to false-positive on a regular PEM key which is NOT base64
    // A regular PEM key starts with "-----BEGIN", which is not valid base64 (contains dashes)
    // So if it contains dashes (and not just at the start/end?), it might be PEM.
    // But base64 can contain '+', '/', and '='.
    
    // Simple heuristic: If it DOESN'T look like a PEM key (no "-----BEGIN"), try base64
    if (!rawKey.includes('-----BEGIN')) {
      try {
        const decoded = atob(rawKey);
        // If successful, use the decoded value
        // And then apply the same newline fix as backend: .replace("\\n", "\n")
        const processed = decoded.replace(/\\n/g, '\n');
        console.info('Using Base64 decoded Google Sheets private key');
        return processed;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // Not base64, proceed to treat as regular key
      }
    }

    // Fallback / Regular key processing
    // Handle literal \n (common in .env files)
    let processedKey = rawKey.replace(/\\n/g, '\n');

    // Final cleanup of multiple newlines just in case
    processedKey = processedKey.replace(/\n+/g, '\n').trim();

    console.info('Using regular Google Sheets private key');
    return processedKey;

  } catch (error) {
    console.error('Error processing Google Sheets private key:', error);
    return '';
  }
}

/**
 * Validate that a private key has the correct format
 * @param privateKey - The private key string to validate
 * @returns boolean indicating if the key appears valid
 */
export function validatePrivateKey(privateKey: string): boolean {
  if (!privateKey || privateKey.trim().length === 0) {
    return false;
  }

  // Check for required PEM format markers
  const hasBeginMarker = privateKey.includes('-----BEGIN PRIVATE KEY-----') || 
                        privateKey.includes('-----BEGIN RSA PRIVATE KEY-----');
  const hasEndMarker = privateKey.includes('-----END PRIVATE KEY-----') || 
                      privateKey.includes('-----END RSA PRIVATE KEY-----');

  return hasBeginMarker && hasEndMarker;
}
