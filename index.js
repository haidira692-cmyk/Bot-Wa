// ==========================
// IMPORT
// ==========================
const readline = require("readline")
const {
  default: makeWASocket,
  useMultiFileAuthState,
  downloadMediaMessage
} = require("@whiskeysockets/baileys")

const P = require("pino")
const axios = require("axios")
const fs = require("fs")

// ==========================
// KONFIG
// ==========================
const AI_KEY = "ISI_API_KEY_KAMU" // opsional

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// ==========================
// START BOT
// ==========================
async function startBot() {

  const { state, saveCreds } = await useMultiFileAuthState("session")

  const sock = makeWASocket({
    logger: P({ level: "silent" }),
    auth: state,
    printQRInTerminal: false // ❌ matikan QR
  })

  sock.ev.on("creds.update", saveCreds)

  // ==========================
  // LOGIN PAIRING CODE (TANPA QR)
  // ==========================
  if (!sock.authState.creds.registered) {
    rl.question("Masukkan nomor WA (contoh 628123456789): ", async (phone) => {
      const code = await sock.requestPairingCode(phone)
      console.log("\n✅ Kode Pairing kamu:", code)
      console.log("👉 Masukkan kode ini di WhatsApp > Perangkat tertaut\n")
    })
  }

  // ==========================
  // CONNECTION STATUS
  // ==========================
  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open") {
      console.log("✅ Bot Online & Siap dipakai!")
    }
  })

  // ==========================
  // WELCOME & GOODBYE
  // ==========================
  sock.ev.on("group-participants.update", async (data) => {
    const user = data.participants[0]

    if (data.action === "add") {
      if (fs.existsSync("./welcome.webp")) {
        await sock.sendMessage(data.id, {
          sticker: fs.readFileSync("./welcome.webp")
        })
      }

      await sock.sendMessage(data.id, {
        text: `👋 Halo @${user.split("@")[0]} selamat datang!`,
        mentions: [user]
      })
    }

    if (data.action === "remove") {
      await sock.sendMessage(data.id, {
        text: `👋 Selamat jalan @${user.split("@")[0]} semoga sukses!`,
        mentions: [user]
      })
    }
  })

  // ==========================
  // AUTO RESPON
  // ==========================
  function autoReply(text) {
    text = text.toLowerCase()

    if (text.includes("halo")) return "Halo juga 👋"
    if (text.includes("makasih")) return "Sama-sama 😄"
    if (text.includes("bot")) return "Ya saya hadir 🤖"

    return null
  }

  // ==========================
  // AI CHAT
  // ==========================
  async function aiReply(prompt) {
    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "openai/gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }]
        },
        {
          headers: {
            Authorization: `Bearer ${AI_KEY}`,
            "Content-Type": "application/json"
          }
        }
      )

      return res.data.choices[0].message.content
    } catch {
      return "AI lagi sibuk 😅"
    }
  }

  // ==========================
  // HANDLE PESAN
  // ==========================
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return

    const from = msg.key.remoteJid

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ""

    // MENU
    if (text === "!menu") {
      await sock.sendMessage(from, {
        text:
`🤖 *MENU BOT*

!menu
!intro
!stiker (reply gambar)
!ai teks
`
      })
    }

    // INTRO
    if (text === "!intro") {
      await sock.sendMessage(from, {
        text: "Halo! Saya bot Kendari 😄"
      })
    }

    // STIKER
    if (msg.message.imageMessage && text === "!stiker") {
      const buffer = await downloadMediaMessage(msg, "buffer")
      await sock.sendMessage(from, { sticker: buffer })
    }

    // AI
    if (text.startsWith("!ai ")) {
      const prompt = text.replace("!ai ", "")
      const reply = await aiReply(prompt)
      await sock.sendMessage(from, { text: reply })
    }

    // AUTO RESPON
    const reply = autoReply(text)
    if (reply) {
      await sock.sendMessage(from, { text: reply })
    }
  })
}

startBot()
