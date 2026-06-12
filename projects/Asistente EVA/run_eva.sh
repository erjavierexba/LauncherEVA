#!/usr/bin/env bash
set -e

APP_FILE="eva.py"
VENV_DIR=".venv"
MODEL_DIR="vosk-model-es-0.42"
MODEL_ZIP="vosk-model-es-0.42.zip"
MODEL_URL="https://alphacephei.com/vosk/models/vosk-model-es-0.42.zip"

echo "=== EVA SETUP ==="

if [ ! -f "$APP_FILE" ]; then
  echo "No encuentro $APP_FILE en esta carpeta."
  echo "Pon tu script Python con ese nombre o cambia APP_FILE en este .sh"
  exit 1
fi

echo "Instalando dependencias del sistema..."
sudo apt update
sudo apt install -y python3 python3-venv python3-pip wget unzip portaudio19-dev

if [ ! -d "$VENV_DIR" ]; then
  echo "Creando entorno virtual..."
  python3 -m venv "$VENV_DIR"
fi

echo "Activando entorno virtual..."
source "$VENV_DIR/bin/activate"

echo "Actualizando pip..."
python -m pip install --upgrade pip

echo "Instalando dependencias Python..."
pip install vosk sounddevice

if [ ! -d "$MODEL_DIR" ]; then
  echo "Descargando modelo Vosk español..."

  if [ ! -f "$MODEL_ZIP" ]; then
    wget -O "$MODEL_ZIP" "$MODEL_URL"
  fi

  echo "Descomprimiendo modelo..."
  unzip "$MODEL_ZIP"

  echo "Modelo instalado en $MODEL_DIR"
else
  echo "Modelo ya existe: $MODEL_DIR"
fi

echo ""
echo "=== Lanzando EVA ==="
python "$APP_FILE"