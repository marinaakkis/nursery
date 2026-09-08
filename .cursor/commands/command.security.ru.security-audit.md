# 🔒 Security Audit Command

Эта команда выполняет комплексную проверку безопасности кода.

---

## Использование

Выделите код или файл, который нужно проверить, и попросите:
```
"Выполни security audit для этого файла"
```

---

## Что проверяется

### 1. OWASP Top 10 уязвимости

#### A01: Broken Access Control
- [ ] Проверка прав доступа на каждом endpoint
- [ ] Нет прямых ссылок на объекты без авторизации
- [ ] CORS настроен правильно

#### A02: Cryptographic Failures
- [ ] Секреты не хардкожены в коде
- [ ] Используется HTTPS для всех запросов
- [ ] Пароли хешируются (bcrypt/argon2)

#### A03: Injection
- [ ] SQL: используются prepared statements
- [ ] NoSQL: санитизация входных данных
- [ ] XSS: экранирование пользовательского ввода
- [ ] Command Injection: нет `eval()` или `exec()`

#### A04: Insecure Design
- [ ] Есть rate limiting
- [ ] Есть валидация всех входных данных
- [ ] Есть обработка ошибок без раскрытия деталей

#### A05: Security Misconfiguration
- [ ] Нет default credentials
- [ ] Debug mode отключен в production
- [ ] Error stack traces не показываются клиенту

#### A06: Vulnerable Components
- [ ] Зависимости актуальные (нет deprecated)
- [ ] Нет известных CVE в пакетах

#### A07: Authentication Failures
- [ ] Нет слабых паролей
- [ ] Есть защита от brute-force
- [ ] Токены истекают

#### A08: Data Integrity Failures
- [ ] Проверка подписи данных
- [ ] Используется SRI для external scripts

#### A09: Logging Failures
- [ ] Критичные операции логируются
- [ ] Секреты не попадают в логи

#### A10: Server-Side Request Forgery (SSRF)
- [ ] Валидация URL перед запросами
- [ ] Whitelist разрешённых доменов

---

### 2. Поиск hardcoded секретов

Проверяются паттерны:
```regex
- API ключи: /[Aa]pi[_-]?[Kk]ey.*['\"]([a-zA-Z0-9]{32,})['\"]/
- JWT токены: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/
- Private keys: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/
- Пароли: /password\s*=\s*['\"](.+)['\"]/
```

---

### 3. TypeScript/JavaScript специфичные проблемы

- [ ] Нет `eval()` или `Function()` конструкторов
- [ ] `dangerouslySetInnerHTML` с санитизацией
- [ ] Нет `require()` с динамическими путями
- [ ] Используется strict mode
- [ ] Нет игнорирования TypeScript ошибок (`@ts-ignore`)

---

### 4. Проверка зависимостей

```bash
npm audit --audit-level=high
```

Проверяется:
- Уязвимости HIGH и CRITICAL severity
- Deprecated пакеты
- Пакеты без обновлений >2 лет

---

## Формат отчёта

После проверки выводится:

```
🔒 SECURITY AUDIT REPORT
─────────────────────────────

✅ PASSED (5)
  ✓ No hardcoded secrets
  ✓ SQL injection protected
  ✓ HTTPS used everywhere
  ✓ Input validation present
  ✓ Error handling implemented

⚠️  WARNINGS (2)
  ⚠ Rate limiting not found
  ⚠ CORS configuration too permissive

❌ CRITICAL (1)
  ✗ Password hashing using MD5 (INSECURE!)
    Location: auth.ts:45
    Fix: Use bcrypt or argon2

🔍 RECOMMENDATIONS
  1. Add rate limiting middleware
  2. Restrict CORS to specific domains
  3. Update password hashing algorithm

📊 SECURITY SCORE: 7/10
```

---

## Remediation Guide

Для каждой найденной проблемы предлагается:

1. **Описание уязвимости**
2. **CVSS Score** (если применимо)
3. **Вектор атаки** (как эксплуатируется)
4. **Безопасное решение** (код с примером)

---

## Пример использования

```typescript
// Проблемный код:
const userId = req.params.id;
const user = await db.query(`SELECT * FROM users WHERE id = ${userId}`);

// После audit AI предложит:
✗ SQL Injection vulnerability detected
  CVSS: 9.8 (CRITICAL)
  Vector: Attacker can inject SQL through userId param

  Fix:
  const userId = req.params.id;
  const user = await db.query(
    'SELECT * FROM users WHERE id = ?',
    [userId]
  );
```

---

## Интеграция с CI/CD

Добавьте в GitHub Actions:

```yaml
- name: Security Audit
  run: |
    npm audit --audit-level=high
    npm run lint:security
```

---

**Используйте эту команду перед каждым commit критичного кода!**
