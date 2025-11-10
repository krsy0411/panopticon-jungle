import { Module } from '@nestjs/common';
import { DataController } from './data.controller';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [KafkaModule],
  controllers: [DataController],
})
export class DataModule {}
