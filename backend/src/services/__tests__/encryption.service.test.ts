import { EncryptionService } from '../encryption.service';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeAll(() => {
    // Set up encryption secret for testing
    process.env.ENCRYPTION_SECRET = 'test-encryption-secret-key-32-chars';
    encryptionService = new EncryptionService();
  });

  describe('encrypt', () => {
    it('should encrypt a string successfully', () => {
      const plainText = 'my-secret-api-key';
      const encrypted = encryptionService.encrypt(plainText);

      // Check that encrypted text is different from plain text
      expect(encrypted).not.toBe(plainText);

      // Check that it follows the IV:AuthTag:Encrypted format
      expect(encrypted.split(':').length).toBe(3);
    });

    it('should produce different encrypted values for the same input', () => {
      const plainText = 'my-secret-api-key';
      const encrypted1 = encryptionService.encrypt(plainText);
      const encrypted2 = encryptionService.encrypt(plainText);

      // Different IVs should produce different encrypted values
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty strings', () => {
      const plainText = '';
      const encrypted = encryptionService.encrypt(plainText);

      expect(encrypted).toBeTruthy();
      expect(encrypted.split(':').length).toBe(3);
    });

    it('should handle special characters', () => {
      const plainText = 'sk-1234!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encryptionService.encrypt(plainText);

      expect(encrypted).toBeTruthy();
      expect(encrypted.split(':').length).toBe(3);
    });
  });

  describe('decrypt', () => {
    it('should decrypt an encrypted string successfully', () => {
      const plainText = 'my-secret-api-key';
      const encrypted = encryptionService.encrypt(plainText);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should decrypt empty strings', () => {
      const plainText = '';
      const encrypted = encryptionService.encrypt(plainText);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should decrypt strings with special characters', () => {
      const plainText = 'sk-1234!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encryptionService.encrypt(plainText);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should decrypt long strings', () => {
      const plainText = 'a'.repeat(1000);
      const encrypted = encryptionService.encrypt(plainText);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should throw error for invalid encrypted format', () => {
      const invalidEncrypted = 'invalid-encrypted-string';

      expect(() => encryptionService.decrypt(invalidEncrypted)).toThrow('Decryption failed');
    });

    it('should throw error for tampered encrypted text', () => {
      const plainText = 'my-secret-api-key';
      const encrypted = encryptionService.encrypt(plainText);

      // Tamper with the encrypted text
      const parts = encrypted.split(':');
      parts[2] = parts[2].substring(0, parts[2].length - 2) + 'XX';
      const tampered = parts.join(':');

      expect(() => encryptionService.decrypt(tampered)).toThrow('Decryption failed');
    });

    it('should throw error for wrong auth tag', () => {
      const plainText = 'my-secret-api-key';
      const encrypted = encryptionService.encrypt(plainText);

      // Replace auth tag with random hex
      const parts = encrypted.split(':');
      parts[1] = 'abcdef1234567890abcdef1234567890';
      const tamperedAuthTag = parts.join(':');

      expect(() => encryptionService.decrypt(tamperedAuthTag)).toThrow('Decryption failed');
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should handle multiple round trips', () => {
      let text = 'original-api-key';

      // Encrypt and decrypt 10 times
      for (let i = 0; i < 10; i++) {
        const encrypted = encryptionService.encrypt(text);
        text = encryptionService.decrypt(encrypted);
      }

      expect(text).toBe('original-api-key');
    });

    it('should maintain data integrity with unicode characters', () => {
      const plainText = 'Hello 世界! 🚀 émojis and spëcial chärs';
      const encrypted = encryptionService.encrypt(plainText);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });
  });
});
