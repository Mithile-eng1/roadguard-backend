FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 1000 user
WORKDIR /home/user/app
RUN chown user:user /home/user/app
# accounts, reports and photos: mount a volume here so they survive redeploys
RUN mkdir -p /home/user/app/store && chown user:user /home/user/app/store
COPY --chown=user requirements-deploy.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir -r requirements-deploy.txt
COPY --chown=user . .
USER user
ENV PORT=7860 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 ROADGUARD_DATA=/home/user/app/store
EXPOSE 7860
CMD ["python", "api_server.py"]
