#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
read -s -p "Enter decryption password: " password
echo
openssl enc -aes-256-cbc -d -salt -pbkdf2 -in "$DIR/.env.enc" -out "$DIR/../.env" -pass pass:"$password" 2>/dev/null
if [ $? -eq 0 ]; then
  echo ".env file created successfully."
else
  echo "Decryption failed. Wrong password?"
  rm -f "$DIR/../.env"
fi
