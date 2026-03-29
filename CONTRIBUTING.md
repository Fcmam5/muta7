# Contributing to Muta7

Thank you for your interest in contributing to Muta7! This document provides guidelines and information for contributors.

## Before You Start

- Read our [Code of Conduct](CODE_OF_CONDUCT.md)
- Review our [AI Usage Policy](CODE_OF_CONDUCT.md#ai-usage-policy)
- Check existing issues and discussions
- All contributions must be made by humans (no automated agents)

## How to Contribute

### Reporting Bugs

- Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md)
- Include steps to reproduce
- Provide browser/OS/version information
- Add screenshots if relevant

### Suggesting Features

- Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md)
- Describe the use case clearly
- Consider if it aligns with project goals

### Submitting Changes

1. **File an Issue First**: Always create an issue describing the problem or feature before implementing
2. **Wait for Discussion**: Allow time for community feedback and approval
3. Fork the repository
4. Create a feature branch: `git checkout -b feature/amazing-feature`
5. Make your changes (keep them minimal and focused)
6. **Thoroughly Review**: If you used AI assistance, review all code manually
7. Commit with clear messages
8. Push to your fork
9. Open a Pull Request with detailed description

## Development Setup

### Prerequisites

- Chromium-based browser
- Git
- Basic JavaScript/HTML/CSS knowledge
- Node.js (for skilleton commands)

### Local Development

1. Clone your fork
```bash
git clone https://github.com/your-username/muta7.git
cd muta7
```

2. Install Skills
```bash
npx skilleton install
```

3. Load Extension in Browser
```bash
# Open Chrome/Edge and navigate to:
chrome://extensions/
# Enable "Developer mode"
# Click "Load unpacked"
# Select the `muta7` directory
```

3. Make changes and reload:
- In `chrome://extensions`, click the reload icon for Muta7
- Or use the keyboard shortcut: `Ctrl+R` on the extensions page

## Code Style

### JavaScript

- Use modern ES6+ features
- Prefer `const`/`let` over `var`
- Use meaningful variable/function names
- Add JSDoc comments for public APIs

### HTML/CSS

- Use semantic HTML5 elements
- Keep CSS modular and component-based
- Follow BEM-like naming for classes
- Ensure accessibility (ARIA labels, keyboard navigation)

### File Organization

- Keep modules in `src/modules/[category]/`
- Follow existing naming conventions
- Avoid adding external dependencies unless necessary

## Testing

### Manual Testing

- Test in multiple Chromium browsers (Chrome, Edge, Brave)
- Verify popup behavior on different screen sizes
- Test content script injection on various websites
- Verify state persistence across browser sessions

### What to Test Before Submitting

- [ ] Extension loads without errors
- [ ] Popup opens and controls work
- [ ] Simulations apply/remove correctly
- [ ] Website scoping functions as expected
- [ ] No console errors in background or content scripts
- [ ] UI is responsive and accessible

## Pull Request Guidelines

### Before Opening PR

- Ensure your branch is up to date with main
- Rebase if necessary (avoid merge commits)
- Test your changes thoroughly
- Update documentation if needed
- If you used AI assistance, acknowledge it in the PR description
- Verify all AI-generated code is manually reviewed and understood

### PR Template

Use the [PR template](.github/PULL_REQUEST_TEMPLATE.md) and include:

- Clear description of changes
- Related issues (if any)
- Testing steps
- Screenshots for UI changes

### Review Process

- Maintainers will review your PR
- Address feedback promptly
- Keep discussion focused and constructive
- PRs should pass all checks before merge

## Project Goals

When contributing, keep these goals in mind:

- **Realistic simulations** over visual gimmicks
- **Minimal performance overhead**
- **Modular, extensible architecture**
- **Developer-friendly workflows**
- **Privacy-first design**

## Architecture

### Key Concepts

- **Modules**: Independent simulation units in `src/modules/`
- **State**: Centralized in background service worker
- **Content Scripts**: Apply effects to web pages
- **Popup**: User interface for controls

### Adding New Modules

1. Create module file exposing:
   ```javascript
   export function enable(config) { /* ... */ }
   export function disable() { /* ... */ }
   export function update(config) { /* ... */ }
   ```

2. Add to `manifest.json` content_scripts
3. Add UI controls in `src/popup/`
4. Wire state handling in background service worker

### Security Considerations

- Never expose sensitive data in content scripts
- Validate all user inputs
- Use secure coding practices
- Review permissions carefully

### AI-Assisted Contributions

- **Issue Required**: Always file an issue before implementing AI-assisted changes
- **Human Review**: All AI-generated code must be thoroughly reviewed by humans
- **Minimal Changes**: Keep AI-assisted contributions focused and minimal
- **Understanding**: Contributors must fully understand all code they submit
- **Testing**: AI-assisted code must be manually tested before submission
- **Attribution**: Acknowledge AI assistance in pull requests
- **No Automated Agents**: Contributions must be made by humans only

## Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Web Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

## Questions?

- Check existing issues and discussions
- Start a new discussion for general questions
- Contact maintainers for security issues (see SECURITY.md)

---

Thank you for contributing to Muta7! Your contributions help make the web more accessible for everyone.
