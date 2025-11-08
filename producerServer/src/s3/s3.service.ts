import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

@Injectable()
export class S3Service {
  private s3Client: S3Client;

  constructor(private configService: ConfigService) {
    const awsEndpoint = this.configService.get<string>('AWS_ENDPOINT');

    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION') || 'ap-northeast-2',
      credentials: fromNodeProviderChain(),
      // 로컬 개발 환경에서 LocalStack 사용
      ...(awsEndpoint && {
        endpoint: awsEndpoint,
        forcePathStyle: true, // LocalStack 필수 옵션
      }),
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
