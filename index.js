const readline = require("readline")
const fs = require("fs")
const axios = require("axios")
const P = require("pino")

const {
  default: makeWASocket,
  useMultiFileAuthState,
  downloadMediaMessage
} = require("@whiskeysockets/baileys")

// ==========================
// KONFIGURASI
// ==========================
const AI_KEY = "ISI_API_KEY_KAMU" // boleh dikosongkan

// readline untuk input nomor (jalan di lokal)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session")

  const sock = makeWASocket({
    logger: P({ level: "silent" }),
    auth: state,
    printQRInTerminal: false // ⛔ NONAKTIFKAN QR
  })

  // ==========================
  // LOGIN PAKAI KODE (PAIRING)
  // ==========================
  if (!state.creds.registered) {
    // ⚠️ di Railway TIDAK bisa pakai readline
    // jadi pairing code SEBAIKNYA dilakukan LOKAL
    rl.question("Masukkan nomor WA (contoh 628123456789): ", async (number) => {
      try {
        const code = await sock.requestPairingCode(number.trim())
        console.log("\n📲 KODE PAIRING ANDA:")
        console.log(code)
        console.log("\nMasukkan kode ini di WhatsApp:")
        console.log("WhatsApp → Perangkat tertaut → Tautkan dengan nomor")
      } catch (err) {
        console.error("Gagal minta pairing code:", err)
      }
    })
  }

  // ==========================
  // SIMPAN SESSION
  // ==========================
  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open") {
      console.log("✅ Bot Online!")
      rl.close()
    }
  })

  // ==========================
  // AUTO WELCOME + STIKER
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
  // AUTO RESPON KATA
  // ==========================
  function autoReply(text) {
    const t = text.toLowerCase()
    if (t.includes("halo")) return "Halo juga 👋"
    if (t.includes("makasih")) return "Sama-sama 😄"
    if (t.includes("bot")) return "Ya saya hadir 🤖"
    return null
  }

  // ==========================
  // AI CHAT
  // ==========================
  async function aiReply(prompt) {
    if (!AI_KEY) return "AI belum diaktifkan."

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

    if (text === "!menu") {
      await sock.sendMessage(from, {
        text:
`🤖 *MENU BOT*
!menu
!intro
!stiker
!ai teks`
      })
    }

    if (text === "!intro") {
      await sock.sendMessage(from, {
        text: "Halo! Saya bot grup Kendari 😄"
      })
    }

    if (msg.message.imageMessage && text === "!stiker") {
      const buffer = await downloadMediaMessage(msg, "buffer")
      await sock.sendMessage(from, { sticker: buffer })
    }

    if (text.startsWith("!ai ")) {
      const prompt = text.replace("!ai ", "")
      const reply = await aiReply(prompt)
      await sock.sendMessage(from, { text: reply })
    }

    const reply = autoReply(text)
    if (reply) {
      await sock.sendMessage(from, { text: reply })
    }
  })
}

startBot()
