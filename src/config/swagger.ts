import swaggerJsdoc from 'swagger-jsdoc';
import { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MCAT Study Schedule Planner API',
      version: '1.0.0',
      description: 'A comprehensive API for generating personalized MCAT study schedules with intelligent resource management and phase-based learning.',
      contact: {
        name: 'MCAT Study Schedule Planner',
        email: 'support@mcatplanner.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      schemas: {
        ScheduleDay: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              format: 'date',
              example: '2025-10-07',
              description: 'Date in YYYY-MM-DD format'
            },
            kind: {
              type: 'string',
              enum: ['break', 'study', 'full_length'],
              description: 'Type of day'
            },
            phase: {
              type: 'integer',
              minimum: 1,
              maximum: 3,
              description: 'Study phase (only for study days)'
            },
            provider: {
              type: 'string',
              example: 'AAMC',
              description: 'Resource provider (only for full_length days)'
            },
            name: {
              type: 'string',
              example: 'FL #3',
              description: 'Resource name (only for full_length days)'
            },
            blocks: {
              type: 'object',
              description: 'Study blocks (only for study days)',
              properties: {
                science_content: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Science content resources (Phase 1)'
                },
                science_discretes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Science discrete question sets (Phase 1)'
                },
                science_passages: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Science passage-based questions (Phase 2)'
                },
                uworld_set: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'UWorld question sets (Phase 2)'
                },
                extra_discretes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Extra discrete sets not used in Phase 1 (Phase 2)'
                },
                aamc_sets: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'AAMC question packs (Phase 3)'
                },
                aamc_CARS_passages: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'AAMC CARS passages (Phase 3)'
                },
                cars: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'CARS passages (Phases 1-2)'
                },
                written_review_minutes: {
                  type: 'integer',
                  example: 60,
                  description: 'Minutes allocated for written review'
                },
                total_resource_minutes: {
                  type: 'integer',
                  example: 240,
                  description: 'Total minutes for resource activities'
                }
              }
            }
          }
        },
        ScheduleMetadata: {
          type: 'object',
          properties: {
            total_days: {
              type: 'integer',
              description: 'Total days in the schedule'
            },
            study_days: {
              type: 'integer',
              description: 'Number of study days'
            },
            break_days: {
              type: 'integer',
              description: 'Number of break days'
            },
            phase_1_days: {
              type: 'integer',
              description: 'Number of Phase 1 days'
            },
            phase_2_days: {
              type: 'integer',
              description: 'Number of Phase 2 days'
            },
            phase_3_days: {
              type: 'integer',
              description: 'Number of Phase 3 days'
            },
            full_length_days: {
              type: 'integer',
              description: 'Number of full-length exam days'
            }
          }
        },
        ScheduleResponse: {
          type: 'object',
          properties: {
            schedule: {
              type: 'array',
              items: { $ref: '#/components/schemas/ScheduleDay' },
              description: 'Array of schedule days'
            },
            metadata: {
              $ref: '#/components/schemas/ScheduleMetadata',
              description: 'Schedule metadata'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            message: {
              type: 'string',
              description: 'Additional error details'
            },
            required: {
              type: 'array',
              items: { type: 'string' },
              description: 'Required parameters (for validation errors)'
            }
          }
        }
      }
    }
  },
  apis: ['./src/controllers/*.ts', './src/app.ts']
};

export const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  const swaggerUi = require('swagger-ui-express');
  
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'MCAT Study Schedule Planner API'
  }));
};
