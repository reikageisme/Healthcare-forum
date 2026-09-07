import { describe, expect, it } from 'vitest';
import { parseOrigins, validateProductionConfig, type ProductionConfigInput } from '../src/core/config.js';

const valid: ProductionConfigInput = {
  environment: 'production',
  databaseUrl: 'postgresql://health:strong-password@postgres.example/health',
  jwtSecret: 'a'.repeat(32),
  corsOrigins: ['https://forum.example'],
  databaseConfigured: true,
  jwtConfigured: true,
  corsConfigured: true,
};

describe('G10 environment configuration', () => {
  it('OPS-01 parses JSON and comma-separated development origins', () => {
    expect(parseOrigins('[\"http://localhost:3000\", \"http://localhost:8000\"]')).toEqual([
      'http://localhost:3000',
      'http://localhost:8000',
    ]);
    expect(parseOrigins('https://forum.example, https://admin.example')).toEqual([
      'https://forum.example',
      'https://admin.example',
    ]);
    expect(parseOrigins(undefined)).toEqual(['http://localhost:3000']);
  });

  it('OPS-02/05 accepts explicit safe production configuration', () => {
    expect(() => validateProductionConfig(valid)).not.toThrow();
  });

  it.each([
    ['database', { databaseConfigured: false }],
    ['development database', { databaseUrl: 'postgresql://postgres:postgres@db:5432/healthcare_forum' }],
    ['JWT secret', { jwtConfigured: false }],
    ['short JWT secret', { jwtSecret: 'short' }],
    ['CORS', { corsConfigured: false }],
    ['wildcard CORS', { corsOrigins: ['*'] }],
    ['invalid CORS origin', { corsOrigins: ['forum.example'] }],
  ])('OPS-02/05 rejects unsafe production %s settings', (_name, override) => {
    expect(() => validateProductionConfig({ ...valid, ...override })).toThrow();
  });

  it('allows development defaults without applying production fail-fast rules', () => {
    expect(() => validateProductionConfig({
      ...valid,
      environment: 'development',
      databaseConfigured: false,
      jwtConfigured: false,
      corsConfigured: false,
    })).not.toThrow();
  });
});
