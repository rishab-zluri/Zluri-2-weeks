# 📊 Test Coverage Reports Guide

This guide explains how to generate and view test coverage reports for both frontend and backend.

## 🎯 Quick Start

### View Coverage Dashboard
Simply open `coverage-dashboard.html` in your browser:
```bash
open coverage-dashboard.html  # macOS
xdg-open coverage-dashboard.html  # Linux
start coverage-dashboard.html  # Windows
```

Or double-click the file in your file explorer.

## 🔧 Generate Coverage Reports

### Backend (Jest)

**Generate all reports (text + HTML + lcov):**
```bash
cd backend
npm run test:coverage
```

**Generate HTML report only:**
```bash
cd backend
npm run test:coverage:html
```

**View backend report:**
```bash
open backend/coverage/index.html
```

### Frontend (Vitest)

**Generate all reports (text + HTML + lcov):**
```bash
cd frontend
npm run test:coverage
```

**View frontend report:**
```bash
open frontend/coverage/index.html
```

## 📁 Coverage Report Locations

```
project-root/
├── coverage-dashboard.html          # Main dashboard (open this!)
├── backend/
│   └── coverage/
│       ├── index.html              # Backend HTML report
│       ├── lcov-report/            # Detailed LCOV report
│       └── lcov.info               # LCOV data file
└── frontend/
    └── coverage/
        ├── index.html              # Frontend HTML report
        └── lcov.info               # LCOV data file
```

## 📊 What's Included in Reports

### Backend Coverage
- **Controllers**: API endpoint handlers
- **Services**: Business logic (auth, database sync, query execution, script execution, Slack)
- **Middleware**: Authentication, error handling, validation, sanitization
- **Utils**: Helper functions, loggers, validators
- **Validation**: Zod schemas for request validation
- **Routes**: API route definitions

### Frontend Coverage
- **Components**: React components (common, layout, query)
- **Pages**: Page components (Login, Dashboard, Query Submission, etc.)
- **Hooks**: Custom React hooks
- **Services**: API client services
- **Context**: React context providers

## 🎨 Coverage Report Features

### Interactive HTML Reports
- **File-by-file breakdown**: Click on any file to see line-by-line coverage
- **Color coding**: 
  - 🟢 Green: Well covered (>80%)
  - 🟡 Yellow: Moderate coverage (50-80%)
  - 🔴 Red: Low coverage (<50%)
- **Coverage metrics**:
  - **Statements**: Individual code statements
  - **Branches**: if/else, switch, ternary conditions
  - **Functions**: Function definitions
  - **Lines**: Physical lines of code

### Coverage Dashboard Features
- **Unified view**: Access both frontend and backend reports from one place
- **Quick commands**: Copy-paste commands to generate reports
- **Visual design**: Clean, modern interface
- **Responsive**: Works on desktop and mobile

## 🚀 CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Backend Tests with Coverage
  run: |
    cd backend
    npm run test:coverage

- name: Run Frontend Tests with Coverage
  run: |
    cd frontend
    npm run test:coverage

- name: Upload Coverage Reports
  uses: actions/upload-artifact@v3
  with:
    name: coverage-reports
    path: |
      backend/coverage/
      frontend/coverage/
```

### Coverage Badges
You can generate coverage badges using services like:
- [Codecov](https://codecov.io/)
- [Coveralls](https://coveralls.io/)
- [Shields.io](https://shields.io/)

## 📈 Coverage Goals

### Current Status
- **Backend**: ~60% branch coverage (target: 90%)
- **Frontend**: ~70% branch coverage (target: 85%)

### Industry Standards
- **Good**: 70-80% coverage
- **Excellent**: 80-90% coverage
- **Outstanding**: 90%+ coverage

### Focus Areas
1. **Critical paths**: Authentication, authorization, data validation
2. **Error handling**: All error scenarios
3. **Edge cases**: Null checks, boundary conditions
4. **Security**: Input sanitization, XSS prevention, SQL injection prevention

## 🛠️ Troubleshooting

### Reports not generating?
```bash
# Clear coverage cache
rm -rf backend/coverage frontend/coverage

# Reinstall dependencies
cd backend && npm install
cd frontend && npm install

# Run tests again
npm run test:coverage
```

### Coverage seems low?
- Check `collectCoverageFrom` in `backend/package.json`
- Check `coverage.exclude` in `frontend/vite.config.ts`
- Ensure test files are in correct locations
- Run tests in watch mode to debug: `npm run test:watch`

### HTML report not opening?
- Make sure tests completed successfully
- Check that `coverage/index.html` exists
- Try opening directly from file explorer
- Check browser console for errors

## 📚 Additional Resources

- [Jest Coverage Documentation](https://jestjs.io/docs/configuration#collectcoverage-boolean)
- [Vitest Coverage Documentation](https://vitest.dev/guide/coverage.html)
- [Istanbul Coverage Reports](https://istanbul.js.org/)
- [LCOV Format Specification](http://ltp.sourceforge.net/coverage/lcov/geninfo.1.php)

## 💡 Tips

1. **Run coverage regularly**: Before commits, PRs, and releases
2. **Focus on quality**: 100% coverage doesn't mean bug-free code
3. **Test critical paths first**: Authentication, payments, data integrity
4. **Use coverage to find gaps**: Not to achieve arbitrary numbers
5. **Review uncovered lines**: They might reveal dead code or missing tests

## 🎯 Next Steps

1. Open `coverage-dashboard.html` in your browser
2. Generate fresh coverage reports
3. Review uncovered areas
4. Write tests for critical paths
5. Aim for 90% branch coverage

---

**Happy Testing! 🧪**
