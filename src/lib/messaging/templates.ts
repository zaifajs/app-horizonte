import type { Locale } from "@/i18n/routing";

export type TemplateKey =
  | "welcome"
  | "payment_reminder"
  | "class_reminder"
  | "cronograma";

export type TemplateMeta = {
  key: TemplateKey;
  label: string;            // shown in the picker
  hint?: string;             // 1-liner explanation
  needsScheduleUrl?: boolean;
};

export const TEMPLATE_META: Record<TemplateKey, TemplateMeta> = {
  welcome:          { key: "welcome",          label: "Welcome",          hint: "Sent after enrolment is confirmed." },
  payment_reminder: { key: "payment_reminder", label: "Payment reminder", hint: "Outstanding balance follow-up." },
  class_reminder:   { key: "class_reminder",   label: "Class reminder",   hint: "Day-before-class nudge." },
  cronograma:       { key: "cronograma",       label: "Send schedule",    hint: "Share the full batch cronograma.", needsScheduleUrl: true },
};

export type TemplateVars = {
  name: string;
  batch: string;
  startDate?: string;
  dueAmount?: string;
  nextSessionDate?: string;
  scheduleUrl?: string;
};

type Bodies = Record<Locale, string>;

export const TEMPLATES: Record<TemplateKey, Bodies> = {
  welcome: {
    en: "Hello {{name}}, welcome to Novo Horizonte! Your registration for batch {{batch}} is confirmed. First class: {{startDate}} at 14:00. Reply here if you have any question.",
    pt: "Olá {{name}}, bem-vindo à Novo Horizonte! A sua inscrição para a turma {{batch}} foi confirmada. Primeira aula: {{startDate}} às 14:00. Responda aqui se tiver alguma dúvida.",
    bn: "হ্যালো {{name}}, Novo Horizonte-এ স্বাগতম! {{batch}} ব্যাচের জন্য আপনার নিবন্ধন নিশ্চিত হয়েছে। প্রথম ক্লাস: {{startDate}} বিকাল ২টায়। কোনো প্রশ্ন থাকলে এখানেই উত্তর দিন।",
    ur: "ہیلو {{name}}، Novo Horizonte میں خوش آمدید! {{batch}} بیچ کے لیے آپ کا اندراج کنفرم ہو گیا ہے۔ پہلی کلاس: {{startDate}} دوپہر ۲ بجے۔ کوئی سوال ہو تو یہاں جواب دیں۔",
    hi: "नमस्ते {{name}}, Novo Horizonte में आपका स्वागत है! {{batch}} बैच के लिए आपका पंजीकरण पुष्ट हो गया है। पहली कक्षा: {{startDate}} दोपहर 2 बजे। कोई प्रश्न हो तो यहीं उत्तर दें।",
  },
  payment_reminder: {
    en: "Hello {{name}}, friendly reminder that {{dueAmount}} is still due for batch {{batch}}. Please complete the payment to keep your enrolment active. Thank you.",
    pt: "Olá {{name}}, um lembrete de que ainda há {{dueAmount}} em dívida para a turma {{batch}}. Por favor conclua o pagamento para manter a sua inscrição ativa. Obrigado.",
    bn: "হ্যালো {{name}}, {{batch}} ব্যাচের জন্য {{dueAmount}} এখনও বাকি আছে। আপনার নিবন্ধন সক্রিয় রাখতে অনুগ্রহ করে পেমেন্ট সম্পূর্ণ করুন। ধন্যবাদ।",
    ur: "ہیلو {{name}}، {{batch}} بیچ کے لیے ابھی بھی {{dueAmount}} باقی ہے۔ اپنے اندراج کو فعال رکھنے کے لیے براہ کرم ادائیگی مکمل کریں۔ شکریہ۔",
    hi: "नमस्ते {{name}}, {{batch}} बैच के लिए अभी भी {{dueAmount}} बकाया है। अपना नामांकन सक्रिय रखने के लिए कृपया भुगतान पूरा करें। धन्यवाद।",
  },
  class_reminder: {
    en: "Hello {{name}}, quick reminder: next class is {{nextSessionDate}} at 14:00, batch {{batch}}. See you there!",
    pt: "Olá {{name}}, lembrete rápido: próxima aula é {{nextSessionDate}} às 14:00, turma {{batch}}. Vemo-nos lá!",
    bn: "হ্যালো {{name}}, দ্রুত অনুস্মারক: পরবর্তী ক্লাস {{nextSessionDate}} বিকাল ২টায়, ব্যাচ {{batch}}। ক্লাসে দেখা হবে!",
    ur: "ہیلو {{name}}، فوری یاد دہانی: اگلی کلاس {{nextSessionDate}} دوپہر ۲ بجے، بیچ {{batch}}۔ ملتے ہیں!",
    hi: "नमस्ते {{name}}, त्वरित अनुस्मारक: अगली कक्षा {{nextSessionDate}} दोपहर 2 बजे, बैच {{batch}}। मिलते हैं!",
  },
  cronograma: {
    en: "Hello {{name}}, here is the full schedule for batch {{batch}}: {{scheduleUrl}}",
    pt: "Olá {{name}}, aqui está o cronograma completo da turma {{batch}}: {{scheduleUrl}}",
    bn: "হ্যালো {{name}}, এখানে {{batch}} ব্যাচের সম্পূর্ণ সময়সূচী রয়েছে: {{scheduleUrl}}",
    ur: "ہیلو {{name}}، یہ {{batch}} بیچ کا مکمل شیڈول ہے: {{scheduleUrl}}",
    hi: "नमस्ते {{name}}, यहाँ बैच {{batch}} का पूरा शेड्यूल है: {{scheduleUrl}}",
  },
};

export function renderTemplate(
  key: TemplateKey,
  locale: Locale,
  vars: TemplateVars,
): string {
  const body = TEMPLATES[key][locale] ?? TEMPLATES[key].en;
  return body.replace(/\{\{(\w+)\}\}/g, (_m, name: keyof TemplateVars) => {
    const v = vars[name];
    return v == null ? `{{${String(name)}}}` : String(v);
  });
}

/** Build a https://wa.me/<number>?text=… link. Phone may include +, spaces, dashes. */
export function buildWaMeLink(phone: string, body: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}
