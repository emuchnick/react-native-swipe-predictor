# Contributing to React Native Swipe Predictor

Thank you for your interest in contributing to React Native Swipe Predictor! We're excited to have you help make gesture interactions in React Native even better.

## Code of Conduct

By participating in this project, you agree to be respectful and constructive in all interactions. We're all here to build something great together.

## How Can I Contribute?

### 🐛 Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected behavior** vs what actually happened
- **Environment details**:
  - React Native version
  - Platform (iOS/Android)
  - Device/Simulator info
  - react-native-swipe-predictor version
- **Code sample** demonstrating the issue
- **Error messages** or logs
- **Screenshots/videos** if applicable

### 💡 Suggesting Features

We love new ideas! When suggesting a feature:

- **Check existing issues** first
- **Explain the problem** your feature would solve
- **Describe your solution** clearly
- **Consider alternatives** you've thought about
- **Include mockups** or examples if applicable

### 🔧 Pull Requests

1. **Fork the repo** and create your branch from `main`
2. **Follow the setup instructions** below
3. **Make your changes** following our coding standards
4. **Add tests** if applicable
5. **Update documentation** as needed
6. **Ensure all tests pass**
7. **Submit your PR** with a clear description

## Development Setup

### Prerequisites

- Node.js 16+
- Yarn
- Xcode 14+ (for iOS development)
- Android Studio (for Android development)
- Rust (only if modifying core physics engine)

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/react-native-swipe-predictor
cd react-native-swipe-predictor

# Install dependencies
yarn install

# Build the project
yarn build

# Run tests
yarn test

# Run the example app
cd example
yarn install
yarn ios # or yarn android
```

### Project Structure

```
├── src/
│   ├── rust/           # Rust physics engine (rarely needs changes)
│   ├── js/             # JavaScript API
│   │   ├── hooks/      # React hooks
│   │   ├── components/ # React components
│   │   └── native/     # Native module interface
│   └── benchmarks/     # Performance tests
├── ios/                # iOS native module
├── android/            # Android native module
├── example/            # Example app for testing
└── docs/               # Documentation
```

### Making Changes

#### JavaScript/TypeScript Changes

Most contributions will be in the JavaScript layer:

```bash
# Watch mode for JS development
yarn dev

# Type checking
yarn typecheck

# Linting
yarn lint
```

#### Native Module Changes (iOS/Android)

For iOS (Swift):
- Edit files in `ios/SwipePredictor/`
- Test in the example app

For Android (Kotlin):
- Edit files in `android/src/main/java/com/swipepredictor/`
- Test in the example app

#### Rust Core Changes

Only needed for physics engine modifications:

```bash
cd src/rust

# Run tests
cargo test

# Build for all platforms
yarn build:rust

# Build for specific platform
yarn build:rust:ios    # or
yarn build:rust:android
```

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow existing code style (enforced by ESLint)
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Native Code

**iOS (Swift):**
- Follow Swift conventions
- Use guard statements for early returns
- Handle errors gracefully

**Android (Kotlin):**
- Follow Kotlin conventions
- Use coroutines for async operations
- Handle null cases properly

### Rust

- Follow Rust conventions (enforced by clippy)
- Keep unsafe blocks minimal and documented
- Add unit tests for new functions

## Testing

### Running Tests

```bash
# JavaScript tests
yarn test

# Rust tests
cd src/rust && cargo test

# Type checking
yarn typecheck

# Linting
yarn lint
```

### Writing Tests

- Test files go next to the code they test
- Use descriptive test names
- Test edge cases
- Mock native modules when testing JS code

Example test:

```typescript
describe('useSwipePredictor', () => {
  it('should calculate prediction with high confidence for consistent swipes', () => {
    // Test implementation
  });
});
```

## Performance Considerations

This library is performance-critical. When contributing:

- **Benchmark your changes** using the example app's benchmark screen
- **Avoid allocations** in hot code paths
- **Use worklets** for animation-related code
- **Profile on real devices**, not just simulators

## Documentation

- Update README.md for user-facing changes
- Update API.md for API changes
- Add inline comments for complex logic
- Include examples for new features

## Commit Messages

Follow conventional commit format:

```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions/changes
- `chore`: Build process or auxiliary tool changes

Example:
```
feat(hooks): add gesture velocity tracking

Add velocity tracking to improve prediction accuracy for fast swipes.
This helps with detecting flick gestures vs controlled swipes.

Closes #123
```

## Release Process

Maintainers handle releases, but good PRs help by:

- Including clear changelogs
- Not breaking existing APIs
- Adding migration guides for breaking changes

## Getting Help

- **Discord**: Join our community (link in README)
- **GitHub Discussions**: Ask questions
- **Issues**: Report bugs or request features

## Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes
- Special thanks in README for significant contributions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Ready to contribute? We can't wait to see what you build! 🚀