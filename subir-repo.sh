#!/bin/bash
# Crea el repo Notes_VTT en GitHub y sube el proyecto
set -e
cd "C:/Users/Sebastian/Documents/Proyectos/Notes_VTT"
TOKEN=$(printf "protocol=https\nhost=github.com\n" | git credential fill 2>/dev/null | grep "^password=" | cut -d= -f2)
echo "== Creando repo (si no existe) =="
curl -s -X POST -H "Authorization: token $TOKEN" https://api.github.com/user/repos \
  -d '{"name":"Notes_VTT","description":"PWA de notas musicales con links a beats de YouTube - Firebase Hosting + Firestore","private":true}' \
  | grep -E '"full_name"|"message"' | head -2
echo "== Subiendo =="
git remote add origin https://github.com/V0ID-O/Notes_VTT.git 2>/dev/null || git remote set-url origin https://github.com/V0ID-O/Notes_VTT.git
git push -u origin main 2>&1 | tail -3
echo "== Fin =="