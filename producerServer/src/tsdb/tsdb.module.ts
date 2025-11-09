import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TsdbService } from './tsdb.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: 'tsdb', // 연결 이름
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('TSDB_HOST'),
        port: configService.get<number>('TSDB_PORT'),
        username: configService.get<string>('TSDB_USERNAME'),
        password: configService.get<string>('TSDB_PASSWORD'),
        database: configService.get<string>('TSDB_DATABASE'),
        entities: [], // 나중에 엔티티 추가
        synchronize: false, // 프로덕션에서는 false
        logging: process.env.NODE_ENV !== 'production',
        ssl: {
          rejectUnauthorized: false, // AWS RDS SSL 연결
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [TsdbService],
  exports: [TsdbService],
})
export class TsdbModule {}
