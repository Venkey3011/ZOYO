# Contributing to ZOYO

First off, thank you for considering contributing to ZOYO! It's people like you that make ZOYO such a great platform.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Guidelines](#coding-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to support@zoyo.app.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- Git
- Basic understanding of React, TypeScript, and Express
- Familiarity with MongoDB (optional)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/zoyo-voice-chat.git
   cd zoyo-voice-chat
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/zoyo-voice-chat.git
   ```

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include as many details as possible:

**Bug Report Template:**
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
 - OS: [e.g. Windows 11, macOS 13]
 - Browser: [e.g. Chrome 118, Safari 16]
 - Node Version: [e.g. 18.17.0]
 - App Version: [e.g. 1.0.0]

**Additional context**
Any other relevant information.
```

### Suggesting Features

Feature suggestions are tracked as GitHub issues. When creating a feature suggestion:

**Feature Request Template:**
```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
What you want to happen.

**Describe alternatives you've considered**
Other solutions or features you've considered.

**Additional context**
Mockups, examples, or references.
```

### Your First Code Contribution

Unsure where to begin? Look for issues labeled:
- `good first issue` - Simple issues for beginners
- `help wanted` - Issues where we need assistance

### Pull Requests

1. Create a new branch:
   ```bash
   git checkout -b feature/my-feature
   # or
   git checkout -b fix/issue-123
   ```

2. Make your changes and commit:
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

3. Push to your fork:
   ```bash
   git push origin feature/my-feature
   ```

4. Open a Pull Request on GitHub

## Development Setup

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your MongoDB URI (optional)
# MONGODB_URI=your_connection_string

# Start development server
npm run dev
```

### Project Structure

```
zoyo-voice-chat/
├── src/
│   ├── components/      # React components
│   │   ├── MobileFrame.tsx
│   │   ├── VoiceRoom.tsx
│   │   ├── AdminConsole.tsx
│   │   └── ...
│   ├── types.ts         # TypeScript interfaces
│   ├── data.ts          # Static data (gifts, avatars)
│   ├── App.tsx          # Root component
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── server.ts            # Express backend
├── package.json
└── vite.config.ts
```

### Running Tests

```bash
# Type checking
npm run lint

# Build test
npm run build
```

## Coding Guidelines

### TypeScript

- Always use TypeScript (no `.js` files)
- Define interfaces for all data structures
- Avoid `any` type unless absolutely necessary
- Use optional chaining (`?.`) and nullish coalescing (`??`)

**Example:**
```typescript
interface User {
  id: string;
  name: string;
  avatar?: string;
  coins: number;
}

function updateUser(user: User, updates: Partial<User>): User {
  return { ...user, ...updates };
}
```

### React Components

- Use functional components with hooks
- Prefer named exports for components
- Keep components focused and single-purpose
- Extract complex logic into custom hooks

**Example:**
```typescript
import React, { useState } from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export default function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 bg-blue-500 text-white rounded"
    >
      {label}
    </button>
  );
}
```

### CSS/Tailwind

- Use Tailwind utility classes
- Create custom classes only when necessary
- Follow mobile-first responsive design
- Maintain consistent spacing (4px base unit)

**Example:**
```tsx
<div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-md">
  <h2 className="text-xl font-bold text-gray-900">Title</h2>
  <p className="text-sm text-gray-600">Description</p>
</div>
```

### State Management

- Use `useState` for local component state
- Lift state up when shared between components
- Use `useEffect` carefully (include all dependencies)
- Clean up side effects (timers, subscriptions)

**Example:**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    // Do something
  }, 1000);

  return () => clearInterval(interval);
}, [dependency]);
```

### API Integration

- Use async/await for API calls
- Handle errors gracefully
- Show loading states
- Provide user feedback

**Example:**
```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');

const fetchData = async () => {
  setLoading(true);
  setError('');
  try {
    const response = await fetch('/api/users');
    const data = await response.json();
    if (data.success) {
      setUsers(data.users);
    } else {
      setError(data.error);
    }
  } catch (err) {
    setError('Failed to fetch data');
  } finally {
    setLoading(false);
  }
};
```

### Backend (Express)

- Use TypeScript with proper types
- Validate all inputs
- Return consistent response format
- Handle errors with try-catch

**Example:**
```typescript
app.post("/api/users", async (req: express.Request, res: express.Response) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      res.status(400).json({ error: "Name and email are required" });
      return;
    }
    
    const user = await createUser({ name, email });
    res.json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

### Examples

```bash
feat(voice-room): add dice duel game

Add a new dice duel game mode where two players compete
by rolling dice. Winner takes the pot.

Closes #123

---

fix(auth): resolve OTP verification issue

OTP codes were expiring too quickly. Extended expiration
time from 3 to 5 minutes.

Fixes #456

---

docs(readme): update installation instructions

Added MongoDB Atlas setup guide and troubleshooting section.
```

## Pull Request Process

### Before Submitting

1. **Update your branch:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Test your changes:**
   ```bash
   npm run lint
   npm run build
   npm run dev
   ```

3. **Update documentation** if you changed APIs or added features

4. **Add/update tests** if applicable

### PR Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature that breaks existing functionality)
- [ ] Documentation update

## How Has This Been Tested?
Describe the tests you ran.

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing unit tests pass locally

## Screenshots (if applicable)
Add screenshots for UI changes.

## Related Issues
Fixes #(issue number)
```

### Review Process

1. At least one maintainer must approve
2. All CI checks must pass
3. No merge conflicts
4. Branch is up-to-date with main

### After Approval

Your PR will be merged using "Squash and Merge" to keep history clean.

## Code Review Guidelines

### For Reviewers

- Be constructive and respectful
- Explain the "why" behind suggestions
- Distinguish between must-fix and nice-to-have
- Approve when ready, request changes when needed

### For Authors

- Don't take criticism personally
- Respond to all comments
- Make requested changes or explain why not
- Thank reviewers for their time

## Development Tips

### Hot Reload

Vite provides instant hot reload. Changes to React components update immediately without full page refresh.

### Debugging

```typescript
// Use console.log sparingly in production code
console.log('Debug:', variable);

// Better: use console.warn for warnings
console.warn('Warning:', issue);

// Better: use console.error for errors
console.error('Error:', error);
```

### Testing Locally

```bash
# Test with in-memory database
npm run dev

# Test with MongoDB
# 1. Set MONGODB_URI in .env
# 2. Start server
npm run dev

# Test production build
npm run build
npm start
```

### Common Issues

**Port 3000 in use:**
```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>
```

**MongoDB connection failed:**
- Check MONGODB_URI format
- Verify IP whitelist in Atlas
- App will fallback to in-memory mode

**Build errors:**
```bash
rm -rf node_modules dist
npm install
npm run build
```

## Getting Help

- 💬 **Discord**: [Join our community](https://discord.gg/zoyo)
- 📧 **Email**: dev@zoyo.app
- 📚 **Docs**: [docs.zoyo.app](https://docs.zoyo.app)

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Credited in release notes
- Mentioned on our social media (if you wish)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to ZOYO! 🎉**
