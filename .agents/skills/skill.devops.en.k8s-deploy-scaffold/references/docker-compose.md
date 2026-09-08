# docker-compose.yaml Templates

Production-representative docker-compose for local development that mirrors the Kubernetes deployment.

## Requirements

- All project services with correct build contexts and Dockerfiles
- All infrastructure dependencies with pinned image versions
- Environment variables split: non-secret inline, secrets via `env_file: .env`
- Port mappings matching Helm values
- Health checks matching probe configuration
- Volume mounts for persistent data
- `depends_on` with `condition: service_healthy` for dependency ordering
- Network isolation between unrelated services

## Application Service Template

```yaml
services:
  {service}:
    build:
      context: ./{service-dir}
      dockerfile: Dockerfile
    ports:
      - "{host-port}:{container-port}"
    environment:
      CONFIG_VAR: "value"
    env_file:
      - .env
    depends_on:
      {dependency}:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:{port}/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s
    restart: unless-stopped
```

## Infrastructure Service Templates

### PostgreSQL

```yaml
  postgres:
    image: postgres:15.18
    environment:
      POSTGRES_USER: {db-user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: {db-name}
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U {db-user} -d {db-name}"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### Redis

```yaml
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### RabbitMQ

```yaml
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: {user}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    ports:
      - "5672:5672"
      - "15672:15672"
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "check_running"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### MongoDB

```yaml
  mongo:
    image: mongo:7
    environment:
      MONGO_INITDB_ROOT_USERNAME: {user}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
      MONGO_INITDB_DATABASE: {db-name}
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### MinIO

```yaml
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: {user}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio-data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### Kafka (with Zookeeper)

```yaml
  zookeeper:
    image: confluentinc/cp-zookeeper:7.9.7
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    healthcheck:
      test: ["CMD-SHELL", "echo ruok | nc localhost 2181"]
      interval: 10s
      timeout: 5s
      retries: 5

  kafka:
    image: confluentinc/cp-kafka:7.9.7
    depends_on:
      zookeeper:
        condition: service_healthy
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    ports:
      - "9092:9092"
    healthcheck:
      test: ["CMD-SHELL", "kafka-topics --bootstrap-server localhost:9092 --list"]
      interval: 10s
      timeout: 5s
      retries: 5
```

## Volumes Section

```yaml
volumes:
  postgres-data:
  mongo-data:
  minio-data:
```

## .env.example

Generate alongside docker-compose with all secret variables (empty values):

```env
# Secrets — copy to .env and fill in
POSTGRES_PASSWORD=
RABBITMQ_PASSWORD=
MONGO_PASSWORD=
MINIO_PASSWORD=
SECRET_KEY=
API_TOKEN=
```
