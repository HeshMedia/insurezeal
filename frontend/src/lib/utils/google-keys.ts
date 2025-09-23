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
    // First try to get the base64 encoded version
    const base64Key = process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY;
    
    if (!base64Key) {
      console.error('No Google Sheets private key found in environment variables');
      return '';
    }

    // Try to decode as base64 first
    try {
      // Check if it looks like a base64 string (no newlines, typical base64 characters)
      if (!base64Key.includes('\n') && !base64Key.includes('\\n') && base64Key.length > 100) {
        const decoded = atob(base64Key);
        
        // Verify it looks like a private key (contains BEGIN PRIVATE KEY)
        if (decoded.includes('BEGIN PRIVATE KEY')) {
          console.info('Using Base64 decoded Google Sheets private key');
          return decoded;
        }
      }
    } catch (error) {
      console.warn('Failed to decode as Base64, treating as regular key:', error);
    }

    // Fallback to regular key processing (handle escaped newlines)
    const processedKey = base64Key.replace(/\\n/g, '\n');
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
