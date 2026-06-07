const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Payments API',
    description:
      'API RESTful em AdonisJS 6 que permite iniciar pagamentos e consultar seu status através de provedores externos de pagamento com suporte a concorrência (Single Flight), tolerância a falhas (Retries/Circuit Breaker) e notificações assíncronas (Webhooks via Kafka).',
    version: '1.0.0',
  },
  servers: [
    {
      url: 'http://localhost:3333',
      description: 'Servidor de Desenvolvimento Local',
    },
  ],
  paths: {
    '/api/v1/payments': {
      post: {
        summary: 'Iniciar um novo pagamento',
        description:
          'Registra um novo pagamento no banco de dados com status `pending` e inicia a transação no provedor de pagamentos externo de forma síncrona.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/InitiatePaymentPayload',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Pagamento iniciado com sucesso',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PaymentResult',
                },
              },
            },
          },
          '422': {
            description: 'Erro de validação nos campos do payload',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidationErrorResponse',
                },
              },
            },
          },
          '502': {
            description: 'Erro no provedor externo de pagamentos (Gateway Indisponível)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/payments/{paymentId}': {
      get: {
        summary: 'Consultar o status de um pagamento',
        description:
          'Retorna o status atual do pagamento. Se o status for `pending`, realiza uma sincronização em tempo real (coalescida com Single Flight) com o provedor de pagamentos externo e persiste o resultado.',
        parameters: [
          {
            name: 'paymentId',
            in: 'path',
            required: true,
            description: 'ID interno do pagamento (UUID)',
            schema: {
              type: 'string',
              format: 'uuid',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Status do pagamento retornado com sucesso',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PaymentResult',
                },
              },
            },
          },
          '404': {
            description: 'Pagamento não encontrado no banco de dados',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '502': {
            description: 'Erro ao tentar sincronizar o status com o provedor externo',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      InitiatePaymentPayload: {
        type: 'object',
        required: ['amount', 'currency', 'method', 'product_id'],
        properties: {
          amount: {
            type: 'integer',
            minimum: 1,
            description:
              'Valor do pagamento na menor unidade da moeda (ex: centavos). Deve ser maior que zero.',
          },
          currency: {
            type: 'string',
            pattern: '^[A-Za-z]{3}$',
            description: 'Código ISO-4217 da moeda (ex: BRL, USD).',
          },
          method: {
            type: 'string',
            enum: ['PAYPAL', 'CREDIT_CARD', 'PIX'],
            description: 'Método de pagamento.',
          },
          product_id: {
            type: 'string',
            format: 'uuid',
            description: 'UUID do produto ou serviço associado.',
          },
          webhook_url: {
            type: 'string',
            format: 'uri',
            description:
              'URL opcional de webhook para envio assíncrono de notificações de mudança de status.',
          },
        },
      },
      PaymentResult: {
        type: 'object',
        properties: {
          paymentId: {
            type: 'string',
            format: 'uuid',
            description: 'UUID gerado interno do pagamento',
          },
          status: {
            type: 'string',
            enum: ['pending', 'processed', 'failed'],
            description: 'Status atual do pagamento',
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description:
              'Código de erro legível por máquina (ex: E_PAYMENT_NOT_FOUND, E_PROVIDER_UNAVAILABLE)',
          },
          message: {
            type: 'string',
            description: 'Mensagem descritiva explicando o erro',
          },
        },
      },
      ValidationErrorResponse: {
        type: 'object',
        properties: {
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string',
                  description: 'Campo que falhou na validação',
                },
                rule: {
                  type: 'string',
                  description: 'Regra de validação violada',
                },
                message: {
                  type: 'string',
                  description: 'Mensagem detalhada do erro para o usuário',
                },
              },
            },
          },
        },
      },
    },
  },
}

export default swaggerSpec
