const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.log(`[TG] Would send to ${chatId}: ${text}`);
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
