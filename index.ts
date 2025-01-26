import TelegramBot from 'node-telegram-bot-api';
import { HfInference } from "@huggingface/inference";

const token = Bun.env.TELEGRAM_TOKEN;
const hfToken = Bun.env.HF_TOKEN;

const hfInference = new HfInference(hfToken);
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Hello, I am a transcribator3000');
});

bot.on('voice', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.voice?.file_id!;
  const fileLink = await bot.getFileLink(fileId);
  if (!fileLink) {
    bot.sendMessage(chatId, 'Error getting file link');
    return;
  }

  const downloadPath = await downloadResource(fileLink).catch(err => {
    bot.sendMessage(chatId, 'Error downloading file');
    return;
  })
  if (!downloadPath) return;
  
  const transcription = await processVoiceMessage(downloadPath).catch(err => {
    bot.sendMessage(chatId, 'Error processing transcription');
    return;
  });
  bot.sendMessage(chatId, transcription, {
    reply_to_message_id: msg.message_id,
  });
  await new Promise(r => setTimeout(r, 500))
  await deleteFile(downloadPath).catch(err => {
    bot.sendMessage(chatId, 'Error deleting file' + err);
    return;
  });
})

async function downloadResource(url: string) {
  const fileType = getFileTypebyUrl(url);
  const response = await fetch(url);
  const blob = await response.blob();

  const fileName = crypto.randomUUID();
  const filePath = `./temp/${fileName}.${fileType}`;

  await Bun.write(filePath, blob);
  return filePath;
}

function getFileTypebyUrl(url: string) {
  return url.split("/").pop()?.split(".").pop();
}

async function processVoiceMessage (fileName: string) {
  const file = Bun.file(fileName)
  const data = await file.arrayBuffer()
  const response = await hfInference.automaticSpeechRecognition(
    {
      model: "openai/whisper-large-v3-turbo",
      data,
    },
    { use_cache: false }
  );
  return response.text;
};

async function deleteFile(filePath: string) {
  const file = Bun.file(filePath)
  const exists = await file.exists()
  if (exists) {
    await file.delete()
  }
}