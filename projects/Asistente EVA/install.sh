#!/usr/bin/env bash
set -e

MODEL_DIR="vosk-model-es-0.42"
MODEL_ZIP="vosk-model-es-0.42.zip"
MODEL_URL="https://alphacephei.com/vosk/models/vosk-model-es-0.42.zip"

echo "=== INSTALADOR MODELO VOSK EVA ==="

echo "Instalando herramientas necesarias..."
sudo apt update
sudo apt install -y wget unzip

if [ -d "$MODEL_DIR" ]; then
  echo "El modelo ya existe: $MODEL_DIR"
  echo "No hago nada."
  exit 0
fi

echo "Descargando modelo Vosk español..."

if [ ! -f "$MODEL_ZIP" ]; then
  wget -O "$MODEL_ZIP" "$MODEL_URL"
else
  echo "Ya existe el zip: $MODEL_ZIP"
fi

echo "Descomprimiendo modelo..."
unzip "$MODEL_ZIP"

echo ""
echo "Modelo Vosk instalado correctamente en:"
echo "$MODEL_DIR"