import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Map @/ path alias to src/
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Allow isolatedModules for speed; no need for type-checking in tests
        isolatedModules: true,
        // Resolve path aliases
        paths: { '@/*': ['./src/*'] },
      },
    }],
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  // Exclude Next.js build artifacts
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
};

export default config;
