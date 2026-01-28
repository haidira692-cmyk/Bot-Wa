const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
} = require("@whiskeysockets/baileys")

const P = require("pino")
const qrcode = require("qrcode-terminal")
const axios = require("axios")
const fs = require("fs")

// ==========================
// GANTI API KEY AI DISINI
// ==========================
const AI_KEY = "ISI_API_KEY_KAMU" // opsional

async function startBot() {

  const { state, saveCreds } = await useMultiFileAuthState("session")

  const sock = makeWASocket({
    logger: P({ level: "silent" }),
    auth: state
  })

  // ==========================
  // QR LOGIN
  // ==========================
  sock.ev.on("connection.update", ({ qr, connection }) => {
    if (qr) qrcode.generate(qr, { small: false })

    if (connection === "open") {
      console.log("✅ Bot Online!")
    }
  })

  sock.ev.on("creds.update", saveCreds)

  // ==========================
  // AUTO WELCOME + STIKER
  // ==========================
  sock.ev.on("group-participants.update", async (data) => {
    const user = data.participants[0]

    if (data.action === "add") {
      await sock.sendMessage(data.id, {
        sticker: fs.readFileSync("./welcome.webp") // taruh stiker welcome
      })

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
  // AUTO RESPON KATA
  // ==========================
  function autoReply(text) {
    text = text.toLowerCase()

    if (text.includes("halo")) return "Halo juga 👋"
    if (text.includes("makasih")) return "Sama-sama 😄"
    if (text.includes("bot")) return "Ya saya hadir 🤖"
    return null
  }

  // ==========================
  // AI CHAT (OPENROUTER FREE)
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

    // ======================
    // MENU
    // ======================
    if (text === "!menu") {
      await sock.sendMessage(from, {
        text:
`🤖 *MENU BOT*

!menu
!intro
!stiker
!ai teks
`
      })
    }

    // ======================
    // INTRO
    // ======================
    if (text === "!intro") {
      await sock.sendMessage(from, {
        text: "Halo! Saya bot grup Kendari 😄"
      })
    }

    // ======================
    // STIKER DARI GAMBAR
    // ======================
    if (msg.message.imageMessage && text === "!stiker") {
      const buffer = await downloadMediaMessage(msg, "buffer")
      await sock.sendMessage(from, { sticker: buffer })
    }

    // ======================
    // AI CHAT
    // ======================
    if (text.startsWith("!ai ")) {
      const prompt = text.replace("!ai ", "")
      const reply = await aiReply(prompt)

      await sock.sendMessage(from, { text: reply })
    }

    // ======================
    // AUTO RESPON
    // ======================
    const reply = autoReply(text)
    if (reply) {
      await sock.sendMessage(from, { text: reply })
    }
  })
}

startBot()

