# Docker and Kubernetes lab commands

## Docker content management
```bash
docker build -t spendwise-api:v1 ./backend
docker images
docker image inspect spendwise-api:v1
docker tag spendwise-api:v1 spendwise-api:latest
docker run --name spendwise-api-test -p 5000:5000 --env-file backend/.env spendwise-api:v1
docker ps -a
docker logs spendwise-api-test
docker exec -it spendwise-api-test sh
docker stop spendwise-api-test
docker rm spendwise-api-test
docker image rm spendwise-api:v1
docker system df
docker image prune
```

## Compose
```bash
docker compose up --build -d
docker compose ps
docker compose logs -f api
docker compose down
# Destructive to local database data: only if you intentionally want to delete the volume
docker compose down -v
```

## Kubernetes
```bash
kubectl apply -f k8s/
kubectl get all -n spendwise
kubectl describe deployment spendwise-api -n spendwise
kubectl logs deployment/spendwise-api -n spendwise
kubectl scale deployment/spendwise-api --replicas=3 -n spendwise
kubectl rollout status deployment/spendwise-api -n spendwise
kubectl rollout history deployment/spendwise-api -n spendwise
kubectl rollout undo deployment/spendwise-api -n spendwise
kubectl delete -f k8s/
```

Note: the provided Kubernetes manifests expect a separately available PostgreSQL instance and a Secret named `spendwise-secrets`. Compose is the easiest first run.
