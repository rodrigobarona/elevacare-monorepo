# Testing Framework for Eleva Care App

This directory contains all the tests for the Eleva Care application. The test suite is organized into three main categories:

## Test Structure

```
tests/
├── unit/          # Unit tests for individual components and functions
├── integration/   # Integration tests for API routes and workflows
├── e2e/           # End-to-end tests for complete user journeys
├── setup.ts       # Global test setup and mocks
└── README.md      # This file
```

## Types of Tests

### Unit Tests

Unit tests focus on individual components, functions, or modules in isolation. These tests are fast and help catch issues early in the development process. Mocks are heavily used to isolate the code being tested.

Examples:

- Component rendering and behavior
- Utility function behavior
- Form validation logic

### Integration Tests

Integration tests verify that different parts of the application work correctly together. These tests focus on critical workflows and communication between different modules.

Examples:

- Expert onboarding flow
- Availability management
- Appointment scheduling
- Payment processing

### End-to-End Tests

E2E tests simulate real user interactions with the application to ensure that all components work together as expected from a user perspective. These tests are slower but provide high confidence in the overall system functionality.

Examples:

- Complete user signup and onboarding
- Booking an appointment
- Completing a payment
- Video consultation flow

## Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (useful during development)
npm run test:watch
```

## Testing Utilities

- **Jest**: Main testing framework
- **React Testing Library**: For testing React components
- **MSW (Mock Service Worker)**: For mocking API requests
- **Playwright**: For E2E tests (future implementation)

## Best Practices

1. **Test Isolation**: Each test should be independent of others
2. **Mocking External Services**: Use mocks for external services like Stripe, Clerk, and APIs
3. **Testing Critical Paths**: Focus tests on business-critical user journeys
4. **Descriptive Test Names**: Tests should be named descriptively (e.g., "should allow completing profile step of expert onboarding")
5. **Arrange-Act-Assert Pattern**: Structure tests with clear setup, action, and verification phases

## Mocking Approach

- **Database**: Use in-memory mocks for the Drizzle database
- **Authentication**: Mock Clerk.js authentication
- **Payments**: Mock Stripe API
- **Third-party Services**: Mock all third-party service integrations

## Future Improvements

- Implement Playwright for more robust E2E testing
- Add visual regression testing
- Implement CI/CD pipeline integration with test reports
- Add performance testing for critical paths
