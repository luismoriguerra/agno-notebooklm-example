FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

ARG USER=app
ARG APP_DIR=/app

RUN groupadd -g 61000 ${USER} \
 && useradd -g 61000 -u 61000 -ms /bin/bash -d ${APP_DIR} ${USER}

WORKDIR ${APP_DIR}

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=${USER}:${USER} . .

USER ${USER}

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
