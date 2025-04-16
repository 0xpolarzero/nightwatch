import process from "node:process";
import input from "input";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

// Run this script to generate a session string:
// pnpm telegram-login

if (!process.env.TELEGRAM_API_ID || !process.env.TELEGRAM_API_HASH) {
  throw new Error("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set");
}

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession("");

const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

(async () => {
  await client.start({
    phoneNumber: async () => await input.text("Phone number: "),
    password: async () => await input.text("2FA password (if any): "),
    phoneCode: async () => await input.text("Code you received: "),
    onError: (err) => console.log(err),
  });

  console.log("🔐 SESSION:", client.session.save()); // copy this for .env
})();
