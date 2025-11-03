import { Kafka } from "kafkajs";

const kafka = new Kafka({
    brokers: ["localhost:9092"], clientId: "cli-producer"
});
const producer = kafka.producer();

async function main() {
    await producer.connect();
    await producer.send({
        topic: "app",
        messages: [
            {
                value: JSON.stringify({
                    timestamp: "2024-12-26T12:34:56.123Z",
                    service: "payment-service",
                    level: "info",
                    message: "333334",
                }),
            },
        ],
    });
    await producer.disconnect();
}

main().catch(console.error);