@echo off
title Al-Maarif University Server & Admin Dashboard
echo ====================================================
echo Starting Al-Maarif College Portal Server...
echo ====================================================

if not exist node_modules (
    echo Installing dependencies (express, better-sqlite3, cors, bcryptjs, jsonwebtoken)...
    npm install
)

echo Starting Server...
node server.js
pause
