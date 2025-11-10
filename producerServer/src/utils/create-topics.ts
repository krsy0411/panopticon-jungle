// 토픽 자동 생성 유틸리티
import { Kafka } from 'kafkajs';
import { generateAuthToken } from 'aws-msk-iam-sasl-signer-js';

export async function createTopics() {
  const isProduction = process.env.NODE_ENV === 'production';
  const brokers = process.env.MSK_BROKERS?.split(',') || ['localhost:9094'];
  const region = process.env.AWS_REGION || 'ap-northeast-2';

  console.log('🔧 Creating Kafka topics...');
  console.log(`Brokers: ${brokers.join(', ')}`);

  const kafka = new Kafka({
    clientId: 'topic-creator',
    brokers,
    ...(isProduction && {
      ssl: true,
      sasl: {
        mechanism: 'oauthbearer',
        oauthBearerProvider: async () => {
          const authTokenResponse = await generateAuthToken({ region });
          return { value: authTokenResponse.token };
        },
      },
    }),
  });

  const admin = kafka.admin();

  try {
    await admin.connect();
    console.log('✅ Connected to Kafka');

    const topics = [
      { topic: 'logs.app', numPartitions: 6, replicationFactor: 2 },
      { topic: 'logs.metric', numPartitions: 6, replicationFactor: 2 },
      { topic: 'logs.http', numPartitions: 6, replicationFactor: 2 },
    ];

    // 기존 토픽 확인
    const existingTopics = await admin.listTopics();
    console.log('📋 Existing topics:', existingTopics);

    const toCreate = topics.filter((t) => !existingTopics.includes(t.topic));

    if (toCreate.length === 0) {
      console.log('ℹ️  All topics already exist');
      return;
    }

    console.log(`📝 Creating ${toCreate.length} topic(s)...`);
    await admin.createTopics({
      topics: toCreate,
      waitForLeaders: true,
    });

    console.log('✅ Topics created successfully!');
    toCreate.forEach((t) =>
      console.log(`   - ${t.topic} (${t.numPartitions} partitions)`),
    );
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await admin.disconnect();
  }
}
