#!/bin/bash
# logs.sh - Ver logs de servicios

SERVICE=$1

if [ -z "$SERVICE" ]; then
    echo "📋 Logs de todos los servicios:"
    echo "   (Ctrl+C para salir)"
    echo ""
    docker compose logs -f --tail=100
else
    echo "📋 Logs de $SERVICE:"
    echo "   (Ctrl+C para salir)"
    echo ""
    docker compose logs -f --tail=100 "$SERVICE"
fi
