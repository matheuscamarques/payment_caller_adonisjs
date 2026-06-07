# Payments API — Code Challenge

API RESTful em **AdonisJS 6 (TypeScript)** que permite iniciar pagamentos para um
produto/serviço através de um **provedor de pagamentos externo** e consultar o status
desses pagamentos. A API persiste cada pagamento em **PostgreSQL** e fala com o provedor
externo traduzindo entre o nosso contrato e o dele.

> É o componente "REST API" (verde) do diagrama do desafio — conectado a um provedor de
> pagamentos externo e a um banco de dados.

```
        ┌──────────────┐        ┌────────────────────────┐
   ───▶ │   REST API   │ ─────▶ │ EXTERNAL PAYMENT PROVIDER│
        │  (este repo) │        └────────────────────────┘
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │   PostgreSQL │
        └──────────────┘
```

## Sumário

- [Endpoints](#endpoints)
- [Arquitetura](#arquitetura)
- [Decisões de projeto](#decisões-de-projeto)
- [Como rodar](#como-rodar)
- [Testes e cobertura](#testes-e-cobertura)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Variáveis de ambiente](#variáveis-de-ambiente)

---

## Endpoints

### `POST /api/v1/payments` — iniciar pagamento

```bash
curl --location 'http://localhost:3333/api/v1/payments' \
  --header 'Content-Type: application/json' \
  --data '{
    "amount": 3452,
    "currency": "BRL",
    "method": "PAYPAL",
    "product_id": "87e9646a-8513-465d-b58d-6df44b9e4925"
  }'
```

```jsonc
// 201 Created
{
  "paymentId": "b018b23b-9931-4438-b55f-782edb05b4c2",
  "status": "pending"
}
```

- `amount`: inteiro em **unidade menor da moeda** (ex.: centavos), `> 0`.
- `currency`: código ISO-4217 (3 letras).
- `method`: `PAYPAL` | `CREDIT_CARD` | `PIX`.
- `product_id`: UUID.

### `GET /api/v1/payments/:paymentId` — consultar status

```bash
curl --location 'http://localhost:3333/api/v1/payments/b018b23b-9931-4438-b55f-782edb05b4c2'
```

```jsonc
// 200 OK
{
  "paymentId": "b018b23b-9931-4438-b55f-782edb05b4c2",
  "status": "processed"
}
```

### Respostas de erro

| Situação                                   | Status | Corpo                                                        |
| ------------------------------------------ | ------ | ------------------------------------------------------------ |
| Payload inválido                           | `422`  | erros de validação (VineJS)                                  |
| Pagamento inexistente                      | `404`  | `{ "code": "E_PAYMENT_NOT_FOUND", "message": "..." }`        |
| Provedor externo indisponível / com erro   | `502`  | `{ "code": "E_PROVIDER_UNAVAILABLE", "message": "..." }`     |

---

## Arquitetura

A solução combina **três** padrões pedidos no desafio, que atuam em eixos diferentes e se
complementam:

| Padrão | O que separa | Onde aparece |
| --- | --- | --- |
| **Ports & Adapters (Hexagonal)** | o núcleo de domínio do mundo externo (HTTP, banco, provedor) | `domain/ports/*` + adapters em `infrastructure/*` e `interfaces/*` |
| **CQRS** | operações de escrita (commands) das de leitura (queries) | `application/commands/*` vs `application/queries/*` + buses |
| **SOLID** | princípios que guiam ambos | DIP via ports; SRP nos mappers; OCP na tradução de métodos |

### Camadas (de dentro para fora)

```
domain/         → entidade Payment, value objects (Money, PaymentMethod, PaymentStatus),
                  PORTS (PaymentRepository, PaymentProvider) e erros. Zero framework.
application/    → casos de uso (CQRS): InitiatePayment (command) e GetPaymentStatus (query),
                  com um command/query bus fino. Depende só dos ports.
infrastructure/ → ADAPTERS de saída: LucidPaymentRepository (Postgres) e HttpPaymentProvider
                  (axios) + a camada anticorrupção (ProviderMapper).
interfaces/     → ADAPTER de entrada: controller HTTP + validator (VineJS).
providers/payments_provider.ts → COMPOSITION ROOT: liga ports↔adapters no container IoC.
```

A regra de dependência aponta sempre **para dentro**: `interfaces` e `infrastructure`
dependem de `application`/`domain`, nunca o contrário.

### Camada anticorrupção (o coração do desafio)

O nosso contrato e o do provedor **não são iguais**. Toda a tradução vive em um único lugar
(`ProviderMapper`), de modo que o domínio jamais conhece o vocabulário do provedor:

| Nosso contrato        | Provedor externo                         |
| --------------------- | ---------------------------------------- |
| `amount` + `currency` | `money: { amount, currency }` (aninhado) |
| `method: "PAYPAL"`    | `payment_method: "pay-pal"` (mapa explícito) |
| `product_id`          | `product_id`                             |
| `paymentId` (nosso)   | `tx_id` (resposta do provedor)           |
| `status` do provedor  | mapeado para `pending`/`processed`/`failed` |

Endpoints do provedor: `POST /init-payment` e `GET /list-payment/:txId`.

---

## Decisões de projeto

- **Ciclo de vida _pending-first_.** No `POST`, o pagamento é criado como `pending`, o
  provedor é chamado e o `tx_id` é guardado — mas a resposta continua `pending`. A
  reconciliação do status real acontece **na leitura** (`GET`), que reconsulta o provedor ao
  vivo, persiste e devolve o status atualizado. Isso bate com os exemplos do enunciado
  (init = `pending`, check = `processed`) e mantém uma única fonte de sincronização.
- **Chamada ao provedor síncrona + _fail-fast_.** Falha de rede/5xx no `POST` marca o
  pagamento como `failed` e retorna `502`. Status terminais (`processed`/`failed`) não
  disparam nova consulta no `GET`.
- **Ports como _abstract classes_, não interfaces.** Interfaces de TypeScript são apagadas em
  runtime e não servem como token de injeção. As `abstract class` `PaymentRepository`/
  `PaymentProvider`/`CommandBus`/`QueryBus` servem ao mesmo tempo de contrato e de token no
  container IoC (DIP de verdade).
- **`axios` no adapter do provedor.** Escolhido pela compatibilidade sólida com **nock**
  (passa pelo módulo `http` do Node), evitando a instabilidade de mockar `fetch`/undici.
- **PostgreSQL + Testcontainers.** Os testes de integração sobem um Postgres real e efêmero
  via Testcontainers — mais fiel que um SQLite em memória, conforme as dicas do desafio.
- **`amount` em unidade menor (inteiro).** Dinheiro nunca é float; evita erros de
  arredondamento.
- **Erros de domínio agnósticos ao transporte.** O domínio lança `DomainError`s; o
  _exception handler_ (borda HTTP) é o único que os traduz para `404`/`422`/`502`.

---

## Como rodar

**Pré-requisitos:** Node.js 20+ (testado em 22), Docker (para o Postgres) e npm.

```bash
# 1. Dependências
npm install

# 2. Variáveis de ambiente
cp .env.example .env
node ace generate:key      # gera o APP_KEY (se necessário)

# 3. Banco de dados (PostgreSQL via docker-compose)
docker compose up -d

# 4. Migrations
node ace migration:run

# 5. Servidor de desenvolvimento (http://localhost:3333)
npm run dev
```

Em seguida, use os `curl` da seção [Endpoints](#endpoints).

> O provedor externo é fictício. Em produção, aponte `PAYMENT_PROVIDER_URL` para o provedor
> real. Nos testes, ele é mockado com nock (nenhuma rede externa é tocada).

---

## Testes e cobertura

A estratégia segue a pirâmide de testes:

| Suíte         | O que cobre                                                        | Dependências            |
| ------------- | ------------------------------------------------------------------ | ----------------------- |
| `unit`        | domínio, value objects, mappers, handlers (com _test doubles_)     | nenhuma (sem Docker)    |
| `integration` | `LucidPaymentRepository` (Postgres real) e `HttpPaymentProvider`   | Postgres (Testcontainers) + nock |
| `functional`  | API ponta a ponta (rota → controller → bus → handler → adapters)   | Postgres + nock + servidor HTTP |

```bash
npm run test:unit          # rápido, sem Docker
npm run test:integration   # sobe um Postgres efêmero (Testcontainers)
npm run test:functional    # e2e
npm test                   # todas as suítes
npm run test:coverage      # todas as suítes + relatório de cobertura (c8)
```

- **Banco mockado (integração):** `tests/helpers/test_database.ts` sobe um container Postgres
  (Testcontainers) **antes** do app ler o ambiente e aponta `DB_*` para ele; cada teste roda
  isolado (truncate por teste).
- **Provedor mockado:** `nock` intercepta `http://external.provider.com`, permitindo afirmar
  o **formato do request** enviado (tradução anticorrupção) e mapear as respostas.
- **Cobertura:** thresholds de **80%** configurados em `.c8rc.json`. A suíte atual fica em
  **~95%** de statements/branches/lines.

> Os testes que precisam de banco exigem Docker. A suíte `unit` não exige nada — útil para
> CI/desenvolvimento rápido.

---

## Estrutura de pastas

```
app/
  payments/
    domain/                         # núcleo (sem framework)
      entities/payment.ts
      value-objects/{money,payment-method,payment-status}.ts
      ports/{payment-repository,payment-provider}.ts
      errors/*.ts
    application/                    # casos de uso (CQRS)
      bus/{command-bus,query-bus}.ts
      commands/initiate-payment/*
      queries/get-payment-status/*
      dto/payment-result.ts
    infrastructure/                 # adapters de saída
      persistence/{models,mappers,lucid-payment.repository.ts}
      provider/{http-payment-provider,provider.mapper,provider.types}.ts
    interfaces/http/                # adapter de entrada
      controllers/payments_controller.ts
      validators/initiate-payment.validator.ts
  exceptions/handler.ts             # domínio → HTTP (404/422/502)
providers/payments_provider.ts      # composition root (IoC)
config/{database,provider}.ts
database/migrations/*_create_payments_table.ts
start/{routes,env,kernel}.ts
tests/{unit,integration,functional,helpers}
docker-compose.yml
```

---

## Variáveis de ambiente

| Variável                  | Descrição                                  | Exemplo                      |
| ------------------------- | ------------------------------------------ | ---------------------------- |
| `PORT` / `HOST`           | porta/host do servidor                     | `3333` / `localhost`         |
| `APP_KEY`                 | chave da aplicação (gerada pelo Adonis)    | —                            |
| `DB_HOST` / `DB_PORT`     | conexão Postgres                           | `127.0.0.1` / `5432`         |
| `DB_USER` / `DB_PASSWORD` | credenciais Postgres                       | `root` / `root`              |
| `DB_DATABASE`             | base de dados                              | `app`                        |
| `PAYMENT_PROVIDER_URL`    | base URL do provedor externo               | `http://external.provider.com` |
| `PAYMENT_PROVIDER_TIMEOUT`| timeout (ms) das chamadas ao provedor      | `5000`                       |

Veja `.env.example` para o conjunto completo.
