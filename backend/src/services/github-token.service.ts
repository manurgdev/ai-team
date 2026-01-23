import { prisma } from '../utils/prisma';
import { EncryptionService } from './encryption.service';
import { Octokit } from '@octokit/rest';

export interface GitHubTokenInfo {
  id: string;
  githubUsername: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class GitHubTokenService {
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  /**
   * Save GitHub token for user (encrypted)
   */
  async saveToken(userId: string, token: string): Promise<GitHubTokenInfo> {
    // Validate token by fetching GitHub user info
    const octokit = new Octokit({ auth: token });

    let githubUsername: string | null = null;
    try {
      const { data: user } = await octokit.users.getAuthenticated();
      githubUsername = user.login;
    } catch (error: any) {
      throw new Error('Invalid GitHub token. Please check your token and try again.');
    }

    // Encrypt the token
    const encryptedToken = this.encryptionService.encrypt(token);

    // Upsert (create or update)
    const githubToken = await prisma.gitHubToken.upsert({
      where: { userId },
      update: {
        encryptedToken,
        githubUsername,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId,
        encryptedToken,
        githubUsername,
        isActive: true,
      },
    });

    return {
      id: githubToken.id,
      githubUsername: githubToken.githubUsername,
      isActive: githubToken.isActive,
      createdAt: githubToken.createdAt,
      updatedAt: githubToken.updatedAt,
    };
  }

  /**
   * Get user's GitHub token info (without exposing the actual token)
   */
  async getTokenInfo(userId: string): Promise<GitHubTokenInfo | null> {
    const githubToken = await prisma.gitHubToken.findUnique({
      where: { userId },
    });

    if (!githubToken) {
      return null;
    }

    return {
      id: githubToken.id,
      githubUsername: githubToken.githubUsername,
      isActive: githubToken.isActive,
      createdAt: githubToken.createdAt,
      updatedAt: githubToken.updatedAt,
    };
  }

  /**
   * Get decrypted GitHub token for internal use
   */
  async getDecryptedToken(userId: string): Promise<string | null> {
    const githubToken = await prisma.gitHubToken.findUnique({
      where: { userId },
    });

    if (!githubToken || !githubToken.isActive) {
      return null;
    }

    try {
      return this.encryptionService.decrypt(githubToken.encryptedToken);
    } catch (error) {
      console.error('Failed to decrypt GitHub token:', error);
      return null;
    }
  }

  /**
   * Delete GitHub token
   */
  async deleteToken(userId: string): Promise<void> {
    await prisma.gitHubToken.delete({
      where: { userId },
    });
  }

  /**
   * Validate GitHub token
   */
  async validateToken(token: string): Promise<{ isValid: boolean; username?: string }> {
    try {
      const octokit = new Octokit({ auth: token });
      const { data: user } = await octokit.users.getAuthenticated();

      return {
        isValid: true,
        username: user.login,
      };
    } catch (error: any) {
      console.error('GitHub token validation failed:', error.message);
      return {
        isValid: false,
      };
    }
  }
}
