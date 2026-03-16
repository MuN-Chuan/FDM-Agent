FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

WORKDIR /app/backend

EXPOSE 8001

CMD ["sh", "-c", "python run_migrations.py && uvicorn app.main:app --host 0.0.0.0 --port 8001"]
