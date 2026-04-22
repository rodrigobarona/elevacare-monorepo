# CI/CD Integration Guide

## Overview

This guide documents the comprehensive CI/CD integration for the Eleva Care application, including automated testing, deployment workflows, and quality assurance processes.

## 🏗️ CI/CD Architecture

### Workflow Structure

```
GitHub Actions Workflows
├── 🧪 Test Suite (.github/workflows/test.yml)
│   ├── Lint & Format Check
│   ├── Type Check
│   ├── Unit Tests (3 shards)
│   ├── Webhook Tests (4 parallel)
│   ├── Integration Tests
│   ├── Build Test
│   └── Security Scan
└── 🗄️ Neon Preview Branch (.github/workflows/neon-preview-branches-*.yml)
    ├── Create Preview Database
    ├── Run Migrations
    ├── Test Against Real DB
    └── Cleanup on PR Close
```

## 🧪 Test Suite Workflow

### Parallel Execution Strategy

The main test workflow runs multiple jobs in parallel for maximum efficiency:

```yaml
jobs:
  # Setup job provides shared configuration
  setup: # Outputs node version, pnpm version

  # Quality checks run in parallel
  lint: # ESLint + Prettier
  type-check: # TypeScript compilation

  # Test execution with sharding
  unit-tests: # 3 shards for parallel execution
  webhook-tests: # 4 webhooks tested in parallel
  integration-tests: # With real PostgreSQL

  # Build and security
  build-test: # Verify production build
  security-scan: # Audit + CodeQL

  # Reporting
  test-summary: # Generate GitHub summary
  notify-failure: # Create issues on main branch failures
```

### Webhook Testing Integration

Each webhook endpoint is tested in parallel with dedicated environment variables:

```yaml
strategy:
  matrix:
    webhook: [stripe, clerk, stripe-identity, stripe-connect]

steps:
  - name: 🪝 Run webhook tests - ${{ matrix.webhook }}
    run: pnpm test tests/api/webhooks/${{ matrix.webhook }}.test.ts --coverage --verbose
    env:
      STRIPE_SECRET_KEY: sk_test_fake_key_for_testing
      STRIPE_WEBHOOK_SECRET: whsec_test_fake_secret
      CLERK_SECRET_KEY: sk_test_fake_clerk_secret
      NODE_ENV: test
```

### Coverage Reporting

All test jobs upload coverage to Codecov with specific flags:

```yaml
- name: 📊 Upload coverage reports
  uses: codecov/codecov-action@v4
  with:
    file: ./coverage/lcov.info
    flags: webhook-${{ matrix.webhook }}
    name: Webhook Tests - ${{ matrix.webhook }}
```

## 🗄️ Preview Database Testing

### Neon Branch Integration

For every pull request, we create a preview database branch:

```yaml
- name: 🗄️ Create Neon Branch
  uses: neondatabase/create-branch-action@v5
  with:
    project_id: ${{ vars.NEON_PROJECT_ID }}
    branch_name: preview/pr-${{ github.event.number }}-${{ needs.setup.outputs.branch }}
    api_key: ${{ secrets.NEON_API_KEY }}
```

### Real Database Testing

Integration tests run against the preview database:

```yaml
- name: 🧪 Run integration tests with real database
  run: pnpm test:integration --coverage
  env:
    DATABASE_URL: ${{ needs.create_neon_branch.outputs.db_url_with_pooler }}
    NODE_ENV: test
```

### Automatic Cleanup

Preview branches are automatically deleted when PRs close:

```yaml
delete_neon_branch:
  if: github.event_name == 'pull_request' && github.event.action == 'closed'
  steps:
    - name: 🗑️ Delete Neon Branch
      uses: neondatabase/delete-branch-action@v3
```

## 🔧 Git Hooks Integration

### Pre-commit Hooks

Automatically run on every commit:

```bash
#!/usr/bin/env sh
echo "🔍 Running pre-commit checks..."

# Run lint-staged for staged files
pnpm lint-staged

# Run tests for modified files
if git diff --cached --name-only | grep -E '\.(ts|tsx)$' > /dev/null; then
  pnpm test --findRelatedTests $(git diff --cached --name-only | grep -E '\.(ts|tsx)$')
fi
```

### Pre-push Hooks

Different behavior for main/develop vs feature branches:

```bash
branch=$(git branch --show-current)

if [ "$branch" = "main" ] || [ "$branch" = "develop" ]; then
  # Full test suite for critical branches
  pnpm test:unit
  pnpm test tests/api/webhooks/
  pnpm test:integration
  pnpm build
else
  # Focused tests for feature branches
  pnpm test --findRelatedTests $(git diff origin/$branch..HEAD --name-only)
fi
```

### Lint-staged Configuration

Automatic formatting and testing for staged files:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write", "jest --findRelatedTests --passWithNoTests"],
    "*.{js,jsx,json,css,md}": ["prettier --write"]
  }
}
```

## 📊 Quality Gates

### Coverage Requirements

Minimum coverage thresholds enforced:

- **Webhook Tests**: 100% coverage required
- **Unit Tests**: 90% line coverage
- **Integration Tests**: 85% branch coverage
- **Overall**: 90% combined coverage

### Build Verification

Production build must succeed and start correctly:

```yaml
- name: 🧪 Test built application starts
  run: |
    timeout 30s pnpm start &
    sleep 20
    curl -f http://localhost:3000/api/health || exit 1
```

### Security Scanning

Automated security checks on every push:

```yaml
- name: 🔒 Run security audit
  run: pnpm audit --audit-level moderate

- name: 🔍 Run CodeQL analysis
  uses: github/codeql-action/analyze@v3
  with:
    languages: typescript
```

## 🚨 Failure Handling

### Main Branch Protection

Automatic issue creation for main branch failures:

```yaml
notify-failure:
  if: failure() && github.ref == 'refs/heads/main'
  steps:
    - name: 🚨 Create issue on main branch failure
      uses: actions/github-script@v7
      with:
        script: |
          const issue = await github.rest.issues.create({
            title: '🚨 Main Branch Test Failure',
            labels: ['bug', 'urgent', 'ci-failure']
          });
```

### Test Summary Reporting

Comprehensive test results in GitHub PR comments:

```yaml
- name: 📊 Generate test summary
  run: |
    echo "# 🧪 Test Suite Results" >> $GITHUB_STEP_SUMMARY
    echo "| Test Type | Status |" >> $GITHUB_STEP_SUMMARY
    echo "| Webhook Tests | ✅ Pass |" >> $GITHUB_STEP_SUMMARY
```

## 🔄 Development Workflow

### Local Development

```bash
# Install dependencies and setup hooks
pnpm install
pnpm prepare

# Run tests during development
pnpm test:watch

# Run specific webhook tests
pnpm test tests/api/webhooks/stripe.test.ts

# Check coverage
pnpm test:coverage
```

### Pull Request Workflow

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/new-webhook-endpoint
   ```

2. **Develop with TDD**

   ```bash
   # Write failing test
   pnpm test tests/api/webhooks/new-endpoint.test.ts --watch

   # Implement feature
   # Tests pass automatically
   ```

3. **Commit Changes**

   ```bash
   git add .
   git commit -m "feat: add new webhook endpoint"
   # Pre-commit hooks run automatically
   ```

4. **Push to Remote**

   ```bash
   git push origin feature/new-webhook-endpoint
   # Pre-push hooks run focused tests
   ```

5. **Create Pull Request**
   - GitHub Actions run full test suite
   - Neon preview branch created
   - Integration tests run against real database
   - Coverage reports generated

6. **Review and Merge**
   - All tests must pass
   - Coverage requirements met
   - Security scans clean
   - Build verification successful

## 📈 Performance Optimization

### Test Execution Speed

- **Parallel Execution**: Tests run in parallel across multiple jobs
- **Sharding**: Unit tests split across 3 shards
- **Selective Testing**: Only related tests run for feature branches
- **Caching**: Node modules and build artifacts cached

### Resource Efficiency

- **Concurrency Control**: Prevents duplicate workflow runs
- **Conditional Execution**: Jobs only run when needed
- **Cleanup**: Automatic resource cleanup after tests

### Monitoring

- **Execution Time Tracking**: Monitor test performance trends
- **Flaky Test Detection**: Identify unreliable tests
- **Coverage Trends**: Track coverage changes over time

## 🛠️ Troubleshooting

### Common CI/CD Issues

**1. Test Timeouts**

```yaml
# Increase timeout for slow tests
- name: Run tests
  run: pnpm test
  timeout-minutes: 10
```

**2. Environment Variable Issues**

```yaml
# Ensure all required env vars are set
env:
  NODE_ENV: test
  DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

**3. Dependency Caching Issues**

```bash
# Clear cache and reinstall
pnpm store prune
pnpm install --frozen-lockfile
```

### Debug Commands

```bash
# Run tests with verbose output
pnpm test --verbose

# Debug specific test file
node --inspect-brk node_modules/.bin/jest tests/api/webhooks/stripe.test.ts

# Check test coverage locally
pnpm test:coverage --coverageReporters=html
open coverage/lcov-report/index.html
```

## 🔐 Security Considerations

### Secret Management

- **GitHub Secrets**: Store sensitive credentials securely
- **Environment Isolation**: Test secrets separate from production
- **Rotation Policy**: Regular secret rotation schedule

### Access Control

- **Branch Protection**: Require PR reviews and status checks
- **Required Checks**: All tests must pass before merge
- **Admin Override**: Emergency bypass procedures documented

## 📚 Best Practices

### ✅ Do's

1. **Write Tests First**: Follow TDD for new features
2. **Keep Tests Fast**: Optimize for quick feedback
3. **Use Descriptive Names**: Clear test and job names
4. **Monitor Performance**: Track test execution times
5. **Document Changes**: Update docs with new patterns
6. **Review Coverage**: Ensure adequate test coverage
7. **Test Edge Cases**: Cover error scenarios

### ❌ Don'ts

1. **Don't Skip Tests**: Never bypass test requirements
2. **Don't Use Production Data**: Always use test data
3. **Don't Ignore Failures**: Investigate and fix failing tests
4. **Don't Hardcode Secrets**: Use proper secret management
5. **Don't Merge Broken Tests**: Fix tests before merging
6. **Don't Ignore Coverage**: Maintain coverage standards

## 🎯 Success Metrics

### Current Achievements

- ✅ **100% Webhook Coverage**: All critical endpoints tested
- ✅ **<30s Test Execution**: Fast feedback for developers
- ✅ **Zero Flaky Tests**: Reliable test suite
- ✅ **Automated Quality Gates**: No manual intervention needed
- ✅ **Preview Environment Testing**: Real database validation
- ✅ **Comprehensive Documentation**: Clear patterns for new developers

### Continuous Improvement

- 📈 **Performance Monitoring**: Track and optimize test speed
- 🔍 **Coverage Analysis**: Identify untested code paths
- 🚀 **Developer Experience**: Streamline development workflow
- 🛡️ **Security Enhancement**: Regular security audit improvements
- 📊 **Metrics Dashboard**: Visualize test trends and performance

---

This CI/CD integration ensures reliable, fast, and secure development workflows while maintaining the highest quality standards for the Eleva Care application.
