import crypto from 'node:crypto';

// Use a secure, random key (32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || 'abcdefghijklmnopqrstuvwxyz123456'; // Store securely!
const IV_LENGTH = 12; // GCM IV length (nonce)

/**
 * Encrypts API key using AES-256-GCM (Authenticated Encryption with Associated Data)
 * GCM mode provides both confidentiality AND authentication
 * 
 * @param apiKey - The API key to encrypt
 * @returns Encrypted format: "iv:encrypted:authTag" (all in hex)
 */
export function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get authentication tag for integrity verification
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + encrypted + ':' + authTag.toString('hex');
}

/**
 * Decrypts API key using AES-256-GCM with authentication tag verification
 * Throws error if authentication tag is invalid (data has been tampered with)
 * 
 * @param encrypted - Encrypted format: "iv:encrypted:authTag" (in hex)
 * @returns Decrypted API key
 * @throws Error if authentication fails or format is invalid
 */
export function decryptApiKey(encrypted: string): string {
  try {
    const parts = encrypted.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format. Expected "iv:encrypted:authTag"');
    }
    
    const [ivHex, encryptedText, authTagHex] = parts;
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    
    // Set authentication tag for verification - if data was tampered, this will throw
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    throw new Error(`Failed to decrypt API key: ${error?.message || 'Unknown error'}`);
  }
}
