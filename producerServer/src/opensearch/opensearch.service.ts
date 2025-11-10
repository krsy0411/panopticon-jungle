import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';

@Injectable()
export class OpenSearchService implements OnModuleInit {
  private readonly logger = new Logger(OpenSearchService.name);
  private client: Client;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // ConfigService에서 읽기
    const node = this.configService.get<string>('OPENSEARCH_NODE');
    const username = this.configService.get<string>('OPENSEARCH_USERNAME');
    const password = this.configService.get<string>('OPENSEARCH_PASSWORD');

    const clientConfig: any = {
      node: node ? node : 'http://localhost:9200',
      ssl: {
        rejectUnauthorized: false, // 개발환경에서는 false
      },
    };

    // 인증추가
    if (username && password) {
      clientConfig.auth = {
        username,
        password,
      };
      this.logger.log('✅ Auth object also configured');
    } else {
      this.logger.error('❌ No auth configured - will use anonymous');
    }

    this.client = new Client(clientConfig);
  }

  /**
   * OpenSearch 연결 테스트
   */
  async checkConnection(): Promise<boolean> {
    try {
      this.logger.log('Attempting to connect to OpenSearch...');
      const response = await this.client.info();
      this.logger.log(
        `✅ OpenSearch connected: ${response.body.version.number}`,
      );
      return true;
    } catch (error) {
      this.logger.error('❌ OpenSearch connection failed');
      this.logger.error(`Error message: ${error.message}`);
      if (error.body) {
        this.logger.error(`Error body: ${JSON.stringify(error.body)}`);
      }
      return false;
    }
  }

  /**
   * 인덱스 존재 여부 확인
   */
  async indexExists(index: string): Promise<boolean> {
    try {
      const response = await this.client.indices.exists({ index });
      return response.body;
    } catch (error) {
      this.logger.error(`Failed to check index ${index}`, error);
      return false;
    }
  }

  /**
   * 인덱스 생성
   */
  async createIndex(index: string, body?: any): Promise<void> {
    try {
      await this.client.indices.create({
        index,
        body,
      });
      this.logger.log(`Index ${index} created successfully`);
    } catch (error) {
      this.logger.error(`Failed to create index ${index}`, error);
      throw error;
    }
  }

  /**
   * 문서 색인
   */
  async indexDocument(index: string, id: string, body: any): Promise<void> {
    try {
      await this.client.index({
        index,
        id,
        body,
        refresh: true, // 즉시 검색 가능하도록 설정
      });
      this.logger.debug(`Document indexed to ${index} with id ${id}`);
    } catch (error) {
      this.logger.error(`Failed to index document`, error);
      throw error;
    }
  }

  /**
   * 문서 검색
   */
  async search(index: string, query: any): Promise<any> {
    try {
      const response = await this.client.search({
        index,
        body: query,
      });
      return response.body;
    } catch (error) {
      this.logger.error(`Search failed`, error);
      throw error;
    }
  }

  /**
   * 클러스터 상태 확인
   */
  async getClusterHealth(): Promise<any> {
    try {
      const response = await this.client.cluster.health();
      return response.body;
    } catch (error) {
      this.logger.error('Failed to get cluster health', error);
      throw error;
    }
  }
}
