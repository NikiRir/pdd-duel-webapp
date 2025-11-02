// ===============================
// 🤖 Auto Edit Script (Hugging Face, MiniMax-M2)
// ===============================

const fetch = require("node-fetch");
const fs = require("fs");
const { execSync } = require("child_process");

const FILE_PATH = "README.md";
const API_URL = "https://api-inference.huggingface.co/models/MiniMaxAI/MiniMax-M2"; // ✅ рабочая модель
const API_KEY = process.env.HUGGINGFACE_API_KEY;

if (!API_KEY) {
  console.error("❌ Ошибка: переменная HUGGINGFACE_API_KEY не найдена.");
  process.exit(1);
}

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
Ты — ассистент, который улучшает README.md проектов.
Вот текущий текст файла:
"""
${content}
"""
Сделай README.md более информативным: добавь краткое описание, установку и пример использования.
Ответь только улучшенным README без пояснений.
`;

    console.log("📡 Отправляю запрос к Hugging Face (MiniMax-M2)...");
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hugging Face API error (${res.status}): ${text}`);
    }

    const data = await res.json();
    const newText =
      Array.isArray(data) && data[0]?.generated_text
        ? data[0].generated_text
        : JSON.stringify(data, null, 2);

    fs.writeFileSync(FILE_PATH, newText, "utf8");
    console.log(`💾 ${FILE_PATH} успешно обновлён!`);

    console.log("📤 Коммитим и пушим изменения...");
    execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
    execSync('git config user.name "github-actions[bot]"');
    execSync(`git add ${FILE_PATH}`);
    execSync(`git commit -m "🤖 Auto-edit ${FILE_PATH} via MiniMax-M2" || echo "⚠️ Нет изменений для коммита"`);
    execSync("git push");

    console.log("✅ Всё готово! Изменения отправлены в репозиторий.");

  } catch (err) {
    console.error("❌ Ошибка:", err.message);
    process.exit(1);
  }
})();
