const crypto = require('crypto');
require('dotenv').config();

// Must be 32 bytes (256 bits) for AES-256-GCM.
// We fallback to a hashed version of JWT_SECRET if DB_ENCRYPTION_KEY is not set.
const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY
    ? Buffer.from(process.env.DB_ENCRYPTION_KEY, 'hex')
    : crypto.createHash('sha256').update(String(process.env.JWT_SECRET || 'orbitron-secret-key')).digest();

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts a plaintext string into a hex string containing IV, AuthTag, and Encrypted Data.
 * Format: iv[12bytes]:authTag[16bytes]:encryptedData
 * @param {string} text Plaintext to encrypt
 * @returns {string} Encrypted packed hex string
 */
function encrypt(text) {
    if (!text) return null;
    try {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (e) {
        console.error('Encryption failing:', e);
        return null;
    }
}

/**
 * Decrypts a packed hex string back to plaintext.
 * @param {string} text Packed hex string from encrypt()
 * @returns {string} Decrypted plaintext
 */
function decrypt(text) {
    if (!text) return null;
    // If it doesn't look like our packed format, return as-is (for backwards compatibility with unencrypted DBs)
    if (!text.includes(':')) {
        return text;
    }

    try {
        const parts = text.split(':');
        if (parts.length !== 3) return text;

        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];

        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error('Decryption failing (wrong key or corrupted data):', e.message);
        return null; // Don't return corrupted data
    }
}

module.exports = {
    encrypt,
    decrypt
};
