// ======================================
// 🤖 Auto Editor — массовое редактирование всех файлов
// Работает через твой Hugging Face Space API
// ======================================

const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// URL твоего Space:
const API_URL = "https://NekitWlk-auto-edit-bot.hf.space/api/edit"; // 👈 замени на свой

// Какие типы файлов редактировать:
const EXTENSIONS = [".js", ".html", ".css", ".json", ".md"];

async function editFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const prompt = `
Ты — AI-редактор. Улучши стиль и читаемость этого файла, не меняя его поведение и смысл.
Файл: ${path.basename(filePath)}
Содержимое:
${content}
`;

  console.log(`📡 Отправляю ${filePath}...`);
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) throw new Error(`Ошибка API: ${res.status}`);
  const data = await res.json();
  const newText = data.text || content;

  fs.writeFileSync(filePath, newText, "utf8");
  console.log(`💾 Обновлён: ${filePath}`);
}

async function run() {
  const files = [];

  // Рекурсивный поиск файлов
  function scan(dir) {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory() && !full.includes(".git") && !full.includes("node_modules")) {
        scan(full);
      } else if (EXTENSIONS.includes(path.extname(full))) {
        files.push(full);
      }
    }
  }

  scan(".");
  console.log(`📂 Найдено файлов: ${files.length}`);

  for (const f of files) {
    try {
      await editFile(f);
    } catch (e) {
      console.error(`⚠️ Пропускаю ${f}: ${e.message}`);
    }
  }

  // Коммитим и пушим
  execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
  execSync('git config user.name "github-actions[bot]"');
  execSync("git add .");
  execSync('git commit -m "🤖 Auto-edit all files via Hugging Face Space" || echo "⚠️ Нет изменений для коммита"');
  execSync("git push");

  console.log("✅ Готово! Все файлы обновлены.");
}

run().catch(e => {
  console.error("❌ Ошибка:", e);
  process.exit(1);
});
