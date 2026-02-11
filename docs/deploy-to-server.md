# Выкладка Модуль.Пульс на сервер

Код нужно залить на тот же сервер, с которого вы его скачивали (или где уже крутится pulse.module.team), собрать образ и запустить контейнер.

## 1. Код на сервере

**Вариант А: репозиторий на сервере уже есть**

```powershell
# На сервере (SSH) в каталоге проекта
cd /path/to/pulse
git pull
```

**Вариант Б: первый раз или клонируете заново**

На сервере (по SSH):

```bash
cd /home/your-user   # или куда принято класть проекты
git clone https://github.com/ваш-org/pulse.git
cd pulse
```

**Вариант В: без git — архивом**

На своей машине соберите архив (без `node_modules` и `.next`), залейте на сервер (SCP, SFTP, WinSCP и т.п.), распакуйте в нужную папку.

---

## 2. Переменные окружения на сервере

В каталоге проекта создайте `.env` (если ещё нет) и заполните по `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — из Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — для серверных операций
- `MFA_COOKIE_SECRET` — случайная строка 32+ символов для production
- при необходимости: `DATABASE_URL`, `RESEND_*`, `TELEGRAM_GATEWAY_TOKEN` и т.д.

Не коммитьте `.env` в git. На сервере файл создаётся вручную или через панель деплоя.

---

## 3. Сборка и запуск (Docker)

На сервере в каталоге проекта:

```bash
# Сборка образа и запуск
docker compose up -d --build
```

Приложение будет слушать порт **3000**. Проверка: `curl http://localhost:3000` или открыть в браузере по домену, который указывает на этот сервер (например https://pulse.module.team, если перед приложением стоит nginx/прокси с SSL).

Остановка:

```bash
docker compose down
```

Пересборка после изменений кода:

```bash
git pull
docker compose up -d --build
```

---

## 4. Если используете Dokploy

- Создайте приложение из репозитория (Git) или из папки на сервере.
- Тип: Dockerfile (путь к Dockerfile в корне репозитория).
- В настройках приложения задайте переменные окружения (как в `.env`).
- Порт контейнера: 3000; домен pulse.module.team настраивается в Dokploy или в обратном прокси (nginx/traefik).

После пуша в репозиторий Dokploy может сам делать пересборку и редеплой, если включён автодеплой.

### 4.1. Redis и сеть (чтобы кеш не отлетал после каждого деплоя)

Приложение подключается к Redis по сети `pulse-redis-zan6ec_default`. При каждом деплое Dokploy создаёт **новый** контейнер; он по умолчанию только в `dokploy-network` и не видит Redis (хост не резолвится). Поэтому после деплоя нужно снова подключить контейнер к сети Redis.

**Вариант А: скрипт на сервере (рекомендуется)**

Раз после деплоя контейнер меняется, можно на сервере раз в минуту проверять: контейнер приложения Pulse уже в сети Redis или нет; если нет — подключить. Тогда после любого деплоя в течение минуты Redis снова заработает без ручных действий.

1. На сервере создайте скрипт (например `/root/pulse-connect-redis.sh`):

```bash
#!/bin/bash
# Подключить контейнер Pulse к сети Redis, если ещё не подключён.
# В cron PATH урезан — задаём путь к docker явно (на сервере проверьте: which docker).
export PATH="/usr/bin:/bin:/usr/local/bin:/snap/bin:$PATH"
DOCKER="${DOCKER:-$(command -v docker)}"
[ -z "$DOCKER" ] && DOCKER=/usr/bin/docker
REDIS_NET="pulse-redis-zan6ec_default"
for cid in $($DOCKER ps -q --filter "name=pulse-module-team"); do
  if $DOCKER inspect "$cid" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | grep -q "$REDIS_NET"; then
    : # уже в сети
  else
    $DOCKER network connect "$REDIS_NET" "$cid" 2>/dev/null || true
  fi
done
```

2. Сделайте исполняемым: `chmod +x /root/pulse-connect-redis.sh`
3. Если при запуске будет `docker: not found` — в начале скрипта задайте полный путь, например `DOCKER=/usr/bin/docker` (на сервере выполните `which docker` и подставьте путь).
4. Добавьте в cron (раз в минуту): `crontab -e` → строка:
   `* * * * * /root/pulse-connect-redis.sh`

После деплоя новый контейнер в течение минуты попадёт в сеть Redis; приложение уже должно иметь `REDIS_URL=redis://pulse-redis-zan6ec-redis-1:6379` в переменных окружения в Dokploy.

**Вариант Б: вручную после каждого деплоя**

На сервере выполнить (подставьте актуальное имя контейнера из `docker ps`):

```bash
docker network connect pulse-redis-zan6ec_default ИМЯ_КОНТЕЙНЕРА_PULSE
```

Имя контейнера можно взять так: `docker ps --format "{{.Names}}" | grep pulse`
