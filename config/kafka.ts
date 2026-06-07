import env from '#start/env'

export interface KafkaConfig {
  bootstrapServers: string[]
  clientId: string
  groupId: string
  topic: string
}

const kafkaConfig: KafkaConfig = {
  bootstrapServers: env.get('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092').split(','),
  clientId: env.get('KAFKA_CLIENT_ID', 'payments-api'),
  groupId: env.get('KAFKA_GROUP_ID', 'payments-webhook-group'),
  topic: env.get('KAFKA_TOPIC', 'payment-status-changed'),
}

export default kafkaConfig
