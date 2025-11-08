import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

@Injectable()
export class S3Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-northeast-2',
      credentials: fromNodeProviderChain(),
    });
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.s3Client.send(new ListBucketsCommand({}));
      return true;
    } catch {
      return false;
    }
  }

  async uploadLog(bucket: string, key: string, data: any): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    });

    await this.s3Client.send(command);
  }
}
