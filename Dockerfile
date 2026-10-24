FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 1000 user
WORKDIR /home/user/app
COPY --chown=user requirements-deploy.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir -r requirements-deploy.txt
COPY --chown=user . .
USER user
ENV PORT=7860
EXPOSE 7860
CMD ["python", "api_server.py"]
