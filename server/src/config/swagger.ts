import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { config } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Go Mookambika API',
      version: '1.0.0',
      description: 'Taxi association platform API — Go Mookambika',
    },
    servers: [
      { url: `http://localhost:${config.PORT}/api/v1`, description: 'Development' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use('/api-docs', swaggerUi.serve as any, swaggerUi.setup(swaggerSpec) as any);
  app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));
}
