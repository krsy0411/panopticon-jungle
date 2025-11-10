import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class TsdbService {
  private readonly logger = new Logger(TsdbService.name);

  constructor(
    @InjectDataSource('tsdb')
    private dataSource: DataSource,
  ) {}

  /**
   * TSDB 연결 테스트
   */
  async checkConnection(): Promise<boolean> {
    try {
      this.logger.log('Attempting to connect to TSDB...');
      await this.dataSource.query('SELECT 1');
      this.logger.log('✅ TSDB connected successfully');
      return true;
    } catch (error) {
      this.logger.error('❌ TSDB connection failed');
      this.logger.error(`Error message: ${error.message}`);
      return false;
    }
  }

  /**
   * TSDB DataSource 반환
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
