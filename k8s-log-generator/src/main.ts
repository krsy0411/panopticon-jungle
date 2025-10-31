import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = 3000;
  await app.listen(port);

  const podName = `local-dev-${Math.floor(Math.random() * 1000)}`;
  const serviceName = 'log-generator';

  console.log(`🚀 ${serviceName} started on port ${port}`);
  console.log(`📦 Pod Name: ${podName}`);

  // 1초마다 로그 생성
  // let counter = 0;

  setInterval(() => {
    // counter++;

    // 다양한 로그 레벨 랜덤 생성
    // const levels = ['info', 'warn', 'error', 'debug'];
    // const level = levels[Math.floor(Math.random() * levels.length)];

    // // 다양한 메시지 패턴
    // const messages = [
    //   'User authentication successful',
    //   'Database query executed',
    //   'API request processed',
    //   'Cache hit',
    //   'Processing payment',
    //   'Sending notification',
    // ];
    // const message = messages[Math.floor(Math.random() * messages.length)];

    // const logData = {
    //   timestamp: new Date().toISOString(),
    //   level: level,
    //   service: serviceName,
    //   pod: podName,
    //   counter: counter,
    //   message: message,
    //   requestId: `req-${Math.random().toString(36).substr(2, 9)}`,
    //   userId: Math.floor(Math.random() * 1000),
    //   duration: Math.floor(Math.random() * 500) + 'ms',
    // };

    // JSON 형태로 로그 출력 (stdout → /var/log/containers/*.log)
    console.log(JSON.stringify({ podName, message: 'test' }));
  }, 1000);
}

bootstrap();
