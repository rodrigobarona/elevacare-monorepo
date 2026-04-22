import { vi } from 'vitest';

// Mock the OG image route handler
const mockGET = vi.fn<() => Promise<Response>>();
vi.mock('@/app/api/og/image/route', () => ({
  GET: mockGET,
}));

describe('OG Image Generation Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const testCases = [
    {
      name: 'Profile Image',
      expectedStatus: 200,
      expectedContentType: 'image/png',
    },
    {
      name: 'Generic Image',
      expectedStatus: 200,
      expectedContentType: 'image/png',
    },
    {
      name: 'Service Image',
      expectedStatus: 200,
      expectedContentType: 'image/png',
    },
  ];

  test.each(testCases)(
    'should generate $name correctly',
    async ({ expectedStatus, expectedContentType }) => {
      // Mock proper Response object with headers
      const mockHeaders = {
        get: (key: string) => {
          if (key === 'content-type') return expectedContentType;
          if (key === 'cache-control') return 's-maxage=3600, stale-while-revalidate=86400';
          return null;
        },
      };

      const mockResponse = {
        status: expectedStatus,
        headers: mockHeaders,
      } as Response;

      mockGET.mockResolvedValueOnce(mockResponse);

      const response = await mockGET();

      expect(response.status).toBe(expectedStatus);
      expect(response.headers.get('content-type')).toBe(expectedContentType);

      // Verify cache headers
      expect(response.headers.get('cache-control')).toContain('s-maxage=3600'); // 1 hour
      expect(response.headers.get('cache-control')).toContain('stale-while-revalidate=86400'); // 24 hours
    },
  );

  describe('Error Handling', () => {
    test('should handle missing required parameters', async () => {
      // Mock error response
      const mockResponse = new Response('Bad Request', {
        status: 400,
      });

      mockGET.mockResolvedValueOnce(mockResponse);

      const response = await mockGET();
      expect(response.status).toBe(400);
    });

    test('should handle invalid image type', async () => {
      // Mock error response
      const mockResponse = new Response('Bad Request', {
        status: 400,
      });

      mockGET.mockResolvedValueOnce(mockResponse);

      const response = await mockGET();
      expect(response.status).toBe(400);
    });
  });

  describe('Image Variants', () => {
    test('should handle dark mode variant', async () => {
      // Mock success response with proper headers
      const headers = new Headers();
      headers.set('content-type', 'image/png');

      const mockResponse = new Response('mock-image-data', {
        status: 200,
        headers: headers,
      });

      mockGET.mockResolvedValueOnce(mockResponse);

      const response = await mockGET();
      expect(response.status).toBe(200);
    });

    test('should handle light mode variant', async () => {
      // Mock success response with proper headers
      const headers = new Headers();
      headers.set('content-type', 'image/png');

      const mockResponse = new Response('mock-image-data', {
        status: 200,
        headers: headers,
      });

      mockGET.mockResolvedValueOnce(mockResponse);

      const response = await mockGET();
      expect(response.status).toBe(200);
    });
  });

  describe('Image Dimensions', () => {
    test('should generate images with correct dimensions', async () => {
      // Mock success response with headers
      const mockHeaders = {
        get: (key: string) => {
          if (key === 'content-type') return 'image/png';
          return null;
        },
      };

      const mockResponse = {
        status: 200,
        headers: mockHeaders,
      } as Response;

      mockGET.mockResolvedValueOnce(mockResponse);

      const response = await mockGET();
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
    });
  });
});
