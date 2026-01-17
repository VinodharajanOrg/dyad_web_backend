# Test Documentation

This directory contains unit tests for the Dyad application.

## Testing Setup

We use [Vitest](https://vitest.dev/) as our testing framework, which is designed to work well with Vite and modern JavaScript.

### Test Commands

Add these commands to your `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- `npm run test` - Run tests once
- `npm run test:watch` - Run tests in watch mode (rerun when files change)
- `npm run test:ui` - Run tests with UI reporter

## Mocking Guidelines

### Mocking API Clients

When testing components that use API calls, mock the API client:

```typescript
import { apiClient } from '@/api/client';

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));
```

### Mocking React Query

When testing hooks that use React Query, provide a QueryClient wrapper:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);
```

## Adding New Tests

1. Create a new file with the `.test.ts` or `.spec.ts` extension
2. Import the functions you want to test
3. Mock any dependencies using `vi.mock()`
4. Write your test cases using `describe()` and `it()`

## Example Tests

- `parseOllamaHost.test.ts` - Testing utility functions
- `path_utils.test.ts` - Testing path manipulation utilities
- See `src/api/__tests__/` for API endpoint testing examples
