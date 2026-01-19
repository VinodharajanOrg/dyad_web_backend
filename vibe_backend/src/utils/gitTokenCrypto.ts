import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

// MUST be exactly 32 bytes
const KEY = Buffer.from(
  process.env.GIT_TOKEN_ENCRYPTION_KEY!,
  'utf8'
);

export function encryptGitToken(token: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

export function decryptGitToken(data: {
  encrypted: string;
  iv: string;
  tag: string;
}) {
  const decipher = crypto.createDecipheriv(
    ALGO,
    KEY,
    Buffer.from(data.iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(data.tag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data.encrypted, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}