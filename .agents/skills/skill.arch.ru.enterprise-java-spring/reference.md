# Java Clean Code Reference (Hexagonal Architecture + Spring)

## 1. Основная идея

Архитектура строится вокруг **бизнес-логики**, а не фреймворка.

Слои:

* domain → бизнес-модель и правила
* application → use cases
* infrastructure → реализация (DB, API)
* interface → controllers (вход)

---

## 2. Структура пакетов

```id="xk29sl"
com.example.project
 ├── domain
 │    ├── model
 │    ├── port
 │    │    ├── in
 │    │    └── out
 │
 ├── application
 │    └── service
 │
 ├── infrastructure
 │    ├── persistence
 │    ├── config
 │    └── security
 │
 └── interface
      └── rest
```

---

## 3. Domain слой (ядро)

❗ НЕ зависит от Spring

Содержит:

* сущности
* value objects
* бизнес-правила

```java id="v4v6cc"
public class User {

    private final String email;

    public User(String email) {
        if (email == null) {
            throw new IllegalArgumentException("Email must not be null");
        }
        this.email = email;
    }
}
```

---

## 4. Ports (интерфейсы)

### Входящие (Use Cases)

```java id="fey0mt"
public interface CreateUserUseCase {
    User createUser(CreateUserCommand command);
}
```

### Исходящие (инфраструктура)

```java id="o4rfvd"
public interface UserRepositoryPort {
    User save(User user);
    Optional<User> findByEmail(String email);
}
```

---

## 5. Application слой (бизнес-логика)

```java id="f0kz7m"
@Service // Spring бин, реализует use case
public class CreateUserService implements CreateUserUseCase {

    private final UserRepositoryPort userRepository;

    public CreateUserService(UserRepositoryPort userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public User createUser(CreateUserCommand command) {
        if (command == null) {
            throw new IllegalArgumentException("Command must not be null");
        }

        return userRepository.save(new User(command.getEmail()));
    }
}
```

---

## 6. Infrastructure слой

Реализует порты:

```java id="6m8mcs"
@Repository // Реализация доступа к данным
public class JpaUserRepositoryAdapter implements UserRepositoryPort {

    private final SpringDataUserRepository repository;

    public JpaUserRepositoryAdapter(SpringDataUserRepository repository) {
        this.repository = repository;
    }

    @Override
    public User save(User user) {
        return repository.save(user);
    }
}
```

---

## 7. Interface слой (REST)

```java id="q3h8r3"
@RestController // REST API слой
@RequestMapping("/users") // Базовый путь
public class UserController {

    private final CreateUserUseCase createUserUseCase;

    public UserController(CreateUserUseCase createUserUseCase) {
        this.createUserUseCase = createUserUseCase;
    }
}
```

---

## 8. Dependency Rule (главное правило)

Зависимости направлены внутрь:

interface → application → domain
infrastructure → application → domain

❌ Нельзя:

* domain → spring
* domain → repository
* application → controller

---

## 9. Null Safety

* Проверки на границах (controller, use case)
* Domain не принимает null
* Optional только на границе портов

---

## 10. DTO и Command

```java id="n0ew8p"
public class CreateUserCommand {
    private String email;
}
```

---

## 11. Транзакции

* Только на application уровне

```java id="q0pfmu"
@Transactional // Управление транзакцией
```

---

## 12. Безопасность

* Проверки в application слое
* Controller не содержит бизнес-логики

---

## 13. Антипаттерны

❌ Anemic domain
❌ Fat controllers
❌ Прямой доступ к repository из controller
❌ Использование Entity как DTO

---
