import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(private dataSource: DataSource) {}

  getHello(): string {
    return 'Hello World!';
  }

  async checkDatabase() {
    try {
      const result = await this.dataSource.query('SELECT NOW()');
      return { status: 'connected', time: result[0].now };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
}
