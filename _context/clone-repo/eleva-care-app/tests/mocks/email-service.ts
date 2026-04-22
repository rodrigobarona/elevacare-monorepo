// Mock email service - Vitest compatible
import { vi } from 'vitest';

interface EmailRenderOptions {
  type: string;
  locale: string;
  data: {
    userName: string;
    userRole: string;
    darkMode: boolean;
    variant: string;
  };
}

interface EmailRenderResult {
  subject: string;
  body: string;
}

type RenderEmailFn = (options: EmailRenderOptions) => Promise<EmailRenderResult>;

export const mockElevaEmailService = {
  renderEmail: vi.fn<RenderEmailFn>().mockImplementation((options) => {
    return Promise.resolve({
      subject: 'Test Email',
      body: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="color-scheme" content="${options.data.darkMode ? 'dark' : 'light'}">
            <style>
              .dark-mode { background-color: #1A1A1A; color: #FFFFFF; }
            </style>
          </head>
          <body class="${options.data.darkMode ? 'dark-mode' : ''}">
            <h1>${options.locale === 'es' ? 'Bienvenido' : 'Welcome'}</h1>
            <img src="test.png" alt="Test Image" />
            <p>Test email content for ${options.type}</p>
          </body>
        </html>
      `,
    });
  }),
};

// Create a mock module
const mockModule = {
  elevaEmailService: mockElevaEmailService,
};

// Export the mock module
export default mockModule;
