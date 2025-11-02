// ===============================
// 🤖 Auto Edit Script (Hugging Face, free)
// ===============================

const fetch = require("node-fetch");
const fs = require("fs");
const { execSync } = require("child_process");

// -------------------------------
// Настройки
// -------------------------------
const FILE_PATH = "README.md"; // какой файл редактируем
const HUGGINGFACE_API_URL = "https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct";
const API_KEY = process.env.HUGGINGFACE_API_KEY;

if (!API_KEY) {
  console.error("❌ Ошибка: переменная HUGGINGFACE_API_KEY не найдена. Добавь её в GitHub Secrets!");
  process.exit(1);
}

// -------------------------------
// Функция запроса к Hugging Face
// -------------------------------
async function queryModel(prompt) {
  console.log("📡 Отправляю запрос к Hugging Face API...");
  const res = await fetch(HUGGINGFACE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ошибка
