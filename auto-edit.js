// ===============================
// 🤖 Auto Edit Script (через твой Hugging Face Space)
// ===============================

const fetch = require("node-fetch");
const fs = require("fs");
const { execSync } = require("child_process");

const FILE_PATH = "README.md";
const API_URL = "https://NekitWlk-auto-edit-bot.hf.space/api/edit"; // 👈 твой Space URL

(async () => {
  try {
    console.log("🚀 Запускаю AI-редактирование...");

    let content = "";
    if (fs.existsSync(FILE_PATH)) {
      content = fs.readFileSync(FILE_PATH, "utf8");
      console.log("📖 Найден README.md, отправляю на улучшение...");
    } else {
      console.log(`⚠️ ${FILE_PATH} не найден, создаю новый.`);
    }

    const prompt = `
Ты — AI-редактор. Перепиши README.md, чтобы он выглядел профессионально и красиво.
Добавь описание проекта, установку и пример использования.

Текущее содержимое:
${content}
`;

    console.log("📡 Отправляю запрос к Hugging Face Space...");
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ошибка от Space (${res.status}): ${text}`);
    }

    const data = await res.json();
    const newText = data.text || "Ошибка: пустой ответ от Space.";

    fs.writeFileSync(FILE_PATH, newText, "utf8");
    console.log(`💾 ${FILE_PATH} успешно обновлён!`);

    console.log("📤 Коммитим и пушим изменения...");
    execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
    execSync('git config user.name "github-actions[bot]"');
    execSync(`git add ${FILE_PATH}`);
    execSync(`git commit -m "🤖 Auto-edit ${FILE_PATH} via Hugging Face Space" || echo "⚠️ Нет изменений для коммита"`);
    execSync("git push");

    console.log("✅ Готово! Изменения отправлены в репозиторий.");

  } catch (err) {
    console.error("❌ Ошибка:", err.message);
    process.exit(1);
  }
})();
