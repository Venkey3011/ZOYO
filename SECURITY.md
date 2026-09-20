# Security Policy

## Supported Versions

We release security updates for the following versions of ZOYO:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

The ZOYO team takes security seriously. We appreciate your efforts to responsibly disclose your findings.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:
- **Email**: security@zoyo.app
- **Subject**: [SECURITY] Brief description of vulnerability

### What to Include

Please include the following information in your report:

1. **Description**: Clear explanation of the vulnerability
2. **Impact**: What can an attacker accomplish?
3. **Steps to Reproduce**: Detailed steps to reproduce the issue
4. **Proof of Concept**: Code or screenshots demonstrating the vulnerability
5. **Suggested Fix**: If you have ideas on how to resolve it
6. **Your Details**: 
   - Name (optional)
   - Contact information
   - Whether you'd like public credit when we fix the issue

### Example Report

```
Subject: [SECURITY] SQL Injection in User Search

Description:
The user search endpoint (/api/users) is vulnerable to SQL injection
through the 'query' parameter.

Impact:
An attacker could potentially:
- Extract sensitive user data
- Modify database records
- Execute arbitrary database commands

Steps to Reproduce:
1. Navigate to /api/users
2. Send POST request with payload: {"query": "'; DROP TABLE users; --"}
3. Observe unauthorized database access

Proof of Concept:
[Include code or screenshots]

Suggested Fix:
Use parameterized queries or ORM methods instead of string concatenation.

Reporter: John Doe (john@example.com)
Credit requested: Yes
```

## Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Varies by severity
  - Critical: 1-7 days
  - High: 7-30 days
  - Medium: 30-90 days
  - Low: Next scheduled release

## Severity Classification

### Critical
- Remote code execution
- Authentication bypass
- Direct data breach
- Mass account compromise

**Response**: Immediate patch, security advisory

### High
- Privilege escalation
- Sensitive data exposure
- Injection vulnerabilities
- Broken authentication

**Response**: Priority patch within 7 days

### Medium
- CSRF vulnerabilities
- Weak encryption
- Information disclosure
- Missing security headers

**Response**: Patch within 30 days

### Low
- Minor information leaks
- Best practice violations
- Non-exploitable bugs

**Response**: Fix in next release

## Security Measures

### Current Protections

**Authentication**
- Password-based authentication with secure hashing
- OTP verification for phone login
- Social OAuth integration
- Session management
- Rate limiting on authentication endpoints

**Authorization**
- Role-based access control (RBAC)
- Granular permission system
- Admin/Manager/User privilege separation
- Protected admin endpoints

**Data Protection**
- Input validation and sanitization
- MongoDB injection prevention (using Mongoose)
- HTTPS enforcement in production
- Environment variable protection
- Sensitive data exclusion from responses

**API Security**
- Express.js security middleware
- CORS configuration
- Request size limits
- Error message sanitization
- No sensitive info in client-side code

**Database Security**
- MongoDB connection string encryption
- User role-based access in DB
- Password field exclusion from queries
- Graceful fallback to in-memory mode

### Pending Improvements

- [ ] JWT token-based authentication
- [ ] Password complexity requirements
- [ ] Account lockout after failed attempts
- [ ] Two-factor authentication (2FA)
- [ ] IP-based rate limiting
- [ ] Security audit logging
- [ ] Automated vulnerability scanning
- [ ] Penetration testing
- [ ] GDPR compliance tools
- [ ] Content Security Policy (CSP) headers

## Safe Configuration

### Environment Variables

Never commit sensitive credentials to version control:

```env
# ❌ NEVER DO THIS
MONGODB_URI=mongodb+srv://admin:password123@cluster.mongodb.net/

# ✅ DO THIS
MONGODB_URI=${MONGODB_URI}
```

Use `.env.example` for templates only.

### MongoDB Atlas

Secure your database:
1. **IP Whitelist**: Restrict to specific IPs in production
2. **Database User**: Use read/write permissions only (not admin)
3. **Strong Password**: Generate complex passwords
4. **Connection String**: Never expose in client-side code
5. **Backup**: Enable automatic backups

### Production Deployment

Security checklist:
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS only (no HTTP)
- [ ] Enable CORS whitelist (no `*` origin)
- [ ] Set secure cookie flags
- [ ] Disable error stack traces
- [ ] Remove console.log statements
- [ ] Enable rate limiting
- [ ] Use helmet.js security headers
- [ ] Implement CSP headers
- [ ] Monitor logs for suspicious activity

## Vulnerability Disclosure Policy

### Public Disclosure

After a vulnerability is fixed:
1. We will publish a security advisory
2. Credit will be given to the reporter (if requested)
3. Details will be shared with the community
4. CVE ID will be requested if applicable

### Embargo Period

We request a **90-day embargo** period before public disclosure to allow:
- Time to develop and test a fix
- Coordination with downstream projects
- Preparation of security advisories
- Deployment to production systems

### Hall of Fame

We maintain a Security Hall of Fame to recognize researchers who responsibly disclose vulnerabilities. Contributors will be listed with their:
- Name (or pseudonym)
- Vulnerability discovered
- Date of disclosure

## Security Best Practices for Developers

### Code Review Checklist

Before committing code:
- [ ] No hardcoded credentials
- [ ] Input validation implemented
- [ ] Error messages don't leak sensitive info
- [ ] SQL injection prevention (use Mongoose)
- [ ] XSS prevention (React escapes by default)
- [ ] CSRF tokens for state-changing requests
- [ ] Proper authorization checks
- [ ] Sensitive operations logged
- [ ] Dependencies up to date
- [ ] No debug code in production

### Secure Coding Guidelines

**Input Validation**
```typescript
// ✅ Good
if (!username || username.length < 3 || username.length > 20) {
  return res.status(400).json({ error: "Invalid username" });
}

// ❌ Bad
// No validation
```

**Error Handling**
```typescript
// ✅ Good
catch (error) {
  console.error(error); // Log for debugging
  res.status(500).json({ error: "Internal server error" });
}

// ❌ Bad
catch (error) {
  res.status(500).json({ error: error.message }); // Leaks internals
}
```

**Authorization**
```typescript
// ✅ Good
if (currentUser.role !== 'admin') {
  return res.status(403).json({ error: "Unauthorized" });
}

// ❌ Bad
// No authorization check
```

## Contact

- **Security Email**: security@zoyo.app
- **General Support**: support@zoyo.app
- **PGP Key**: Available on request

## Acknowledgments

We thank the following security researchers for their responsible disclosure:

*List will be updated as vulnerabilities are reported and fixed.*

---

**Last Updated**: 2026-09-19
**Version**: 1.0
