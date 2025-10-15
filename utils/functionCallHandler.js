/**
 * Function Call Handler Modülü
 * OpenAI function call'larını işleyen modül
 */

/**
 * Function call handler'ları
 * @param {Object} handlers - Handler fonksiyonları
 * @param {Function} handlers.navigateUser - Navigasyon handler'ı
 * @param {Function} handlers.changeFloor - Kat değiştirme handler'ı
 * @param {Function} handlers.findSpecialLocation - Özel lokasyon bulma handler'ı
 * @param {Function} handlers.registerUser - Kullanıcı kayıt handler'ı
 * @param {Function} handlers.loginUser - Kullanıcı giriş handler'ı
 * @param {Function} handlers.visitLocation - Lokasyon ziyaret handler'ı
 * @returns {Function} Function call router'ı
 */
export function createFunctionCallRouter(handlers) {
  return async (functionCall) => {
    const { name, arguments: argsStr } = functionCall;

    console.log(`Fonksiyon çağrısı: ${name}`, argsStr);

    try {
      switch (name) {
        case "navigate_user":
          if (handlers.navigateUser) {
            await handlers.navigateUser(argsStr);
          }
          break;

        case "change_floor":
          if (handlers.changeFloor) {
            handlers.changeFloor(argsStr);
          }
          break;

        case "find_special_location":
          if (handlers.findSpecialLocation) {
            await handlers.findSpecialLocation(argsStr);
          }
          break;

        case "register_user":
          if (handlers.registerUser) {
            await handlers.registerUser(argsStr);
          }
          break;

        case "login_user":
          if (handlers.loginUser) {
            await handlers.loginUser(argsStr);
          }
          break;

        case "visit_location":
          if (handlers.visitLocation) {
            await handlers.visitLocation(argsStr);
          }
          break;

        default:
          console.warn(`Bilinmeyen function call: ${name}`);
      }
    } catch (error) {
      console.error(`Function call hatası (${name}):`, error);
    }
  };
}

/**
 * OpenAI function tanımları
 */
export const OPENAI_FUNCTIONS = [
  {
    name: "navigate_user",
    description: "Kullanıcının navigasyon talebini işler.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "change_floor",
    description: "Kullanıcı kat değişikliği belirttiğinde çağrılır (indim, çıktım, vb.)",
    parameters: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down"] },
      },
      required: ["direction"],
    },
  },
  {
    name: "find_special_location",
    description: "Kullanıcının özel bir lokasyon tipine (tuvalet, atm, acil çıkış vb.) yönlendirilmesi",
    parameters: {
      type: "object",
      properties: {
        location_type: {
          type: "string",
          enum: [
            "wc",
            "exit",
            "entrance",
            "baby-care",
            "fire-exit",
            "emergency-exit",
            "first-aid",
            "atm",
            "info-desk",
            "pharmacy",
          ],
          description: "Aranan özel lokasyon tipi",
        },
        user_location: {
          type: "string",
          description: "Kullanıcının şu anki konumu (opsiyonel)",
        },
      },
      required: ["location_type"],
    },
  },
  {
    name: "register_user",
    description: "Kullanıcı kayıt işlemi",
    parameters: {
      type: "object",
      properties: {
        username: { type: "string" },
        email: { type: "string" },
        password: { type: "string" },
      },
      required: ["username", "email", "password"],
    },
  },
  {
    name: "login_user",
    description: "Kullanıcı giriş işlemi",
    parameters: {
      type: "object",
      properties: {
        username: { type: "string" },
        password: { type: "string" },
      },
      required: ["username", "password"],
    },
  },
  {
    name: "visit_location",
    description: "Kullanıcının bir lokasyonu ziyaret ettiğini kaydet",
    parameters: {
      type: "object",
      properties: {
        location_id: { type: "string" },
        location_name: { type: "string" },
      },
      required: ["location_id", "location_name"],
    },
  },
];
