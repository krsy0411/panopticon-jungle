import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { RdbService } from './rdb.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: 'rdb', // 연결 이름
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('RDB_HOST'),
        port: configService.get<number>('RDB_PORT'),
        username: configService.get<string>('RDB_USERNAME'),
        password: configService.get<string>('RDB_PASSWORD'),
        database: configService.get<string>('RDB_DATABASE'),
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
  providers: [RdbService],
  exports: [RdbService],
})
export class RdbModule {}
