import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class RdbService {
  private readonly logger = new Logger(RdbService.name);

  constructor(
    @InjectDataSource('rdb')
    private dataSource: DataSource,
  ) {}

  /**
   * RDB 연결 테스트
   */
  async checkConnection(): Promise<boolean> {
    try {
      this.logger.log('Attempting to connect to RDB...');
      await this.dataSource.query('SELECT 1');
      this.logger.log('✅ RDB connected successfully');
      return true;
    } catch (error) {
      this.logger.error('❌ RDB connection failed');
      this.logger.error(`Error message: ${error.message}`);
      return false;
    }
  }

  /**
   * RDB DataSource 반환
   */
  getDataSource(): DataSource {
    return this.dataSource;
  }

  /**
   * 직접 쿼리 실행
   */
  async query(sql: string, parameters?: any[]): Promise<any> {
    try {
      return await this.dataSource.query(sql, parameters);
    } catch (error) {
      this.logger.error(`Query execution failed: ${error.message}`);
      throw error;
    }
  }
}
