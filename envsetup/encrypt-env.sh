#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ ! -f "$DIR/../.env" ]; then
  echo "No .env file found."
  exit 1
fi
read -s -p "Enter encryption password: " password
echo
read -s -p "Confirm password: " password2
echo
if [ "$password" != "$password2" ]; then
  echo "Passwords don't match."
  exit 1
fi
openssl enc -aes-256-cbc -salt -pbkdf2 -in "$DIR/../.env" -out "$DIR/.env.enc" -pass pass:"$password"
if [ $? -eq 0 ]; then
  echo ".env.enc file created successfully."
else
  echo "Encryption failed."
  rm -f "$DIR/.env.enc"
fi
