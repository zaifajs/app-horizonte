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

export const EMAIL_SUBJECTS: Record<TemplateKey, Bodies> = {
  welcome: {
    en: "Welcome to Novo Horizonte — your batch {{batch}} is confirmed",
    pt: "Bem-vindo à Novo Horizonte — turma {{batch}} confirmada",
    bn: "Novo Horizonte-এ স্বাগতম — আপনার {{batch}} ব্যাচ নিশ্চিত",
    ur: "Novo Horizonte میں خوش آمدید — آپ کا {{batch}} بیچ کنفرم ہے",
    hi: "Novo Horizonte में स्वागत — आपका {{batch}} बैच पुष्ट",
  },
  payment_reminder: {
    en: "Payment reminder — {{dueAmount}} outstanding for batch {{batch}}",
    pt: "Lembrete de pagamento — {{dueAmount}} em dívida para a turma {{batch}}",
    bn: "পেমেন্ট অনুস্মারক — {{batch}} ব্যাচের জন্য {{dueAmount}} বাকি",
    ur: "ادائیگی کی یاد دہانی — {{batch}} بیچ کے لیے {{dueAmount}} باقی",
    hi: "भुगतान अनुस्मारक — {{batch}} बैच के लिए {{dueAmount}} बकाया",
  },
  class_reminder: {
    en: "Class reminder — {{batch}} on {{nextSessionDate}}",
    pt: "Lembrete de aula — {{batch}} em {{nextSessionDate}}",
    bn: "ক্লাস অনুস্মারক — {{batch}} {{nextSessionDate}}-এ",
    ur: "کلاس کی یاد دہانی — {{batch}} {{nextSessionDate}} کو",
    hi: "कक्षा अनुस्मारक — {{batch}} {{nextSessionDate}} को",
  },
  cronograma: {
    en: "Your batch schedule — {{batch}}",
    pt: "Cronograma da sua turma — {{batch}}",
    bn: "আপনার ব্যাচের সময়সূচী — {{batch}}",
    ur: "آپ کا بیچ شیڈول — {{batch}}",
    hi: "आपके बैच का शेड्यूल — {{batch}}",
  },
};

export const TEMPLATES: Record<TemplateKey, Bodies> = {
  welcome: {
    en: "Hello {{name}},\n\nWelcome to Novo Horizonte! Your registration for batch {{batch}} is confirmed. First class: {{startDate}} at 14:00.\n\nReply here if you have any question.\n\n— Novo Horizonte",
    pt: "Olá {{name}},\n\nBem-vindo à Novo Horizonte! A sua inscrição para a turma {{batch}} foi confirmada. Primeira aula: {{startDate}} às 14:00.\n\nResponda aqui se tiver alguma dúvida.\n\n— Novo Horizonte",
    bn: "হ্যালো {{name}},\n\nNovo Horizonte-এ স্বাগতম! {{batch}} ব্যাচের জন্য আপনার নিবন্ধন নিশ্চিত হয়েছে। প্রথম ক্লাস: {{startDate}} বিকাল ২টায়।\n\nকোনো প্রশ্ন থাকলে এখানেই উত্তর দিন।\n\n— Novo Horizonte",
    ur: "ہیلو {{name}}،\n\nNovo Horizonte میں خوش آمدید! {{batch}} بیچ کے لیے آپ کا اندراج کنفرم ہو گیا ہے۔ پہلی کلاس: {{startDate}} دوپہر ۲ بجے۔\n\nکوئی سوال ہو تو یہاں جواب دیں۔\n\n— Novo Horizonte",
    hi: "नमस्ते {{name}},\n\nNovo Horizonte में आपका स्वागत है! {{batch}} बैच के लिए आपका पंजीकरण पुष्ट हो गया है। पहली कक्षा: {{startDate}} दोपहर 2 बजे।\n\nकोई प्रश्न हो तो यहीं उत्तर दें।\n\n— Novo Horizonte",
  },
  payment_reminder: {
    en: "Hello {{name}},\n\nFriendly reminder that {{dueAmount}} is still due for batch {{batch}}. Please complete the payment to keep your enrolment active.\n\nThank you,\nNovo Horizonte",
    pt: "Olá {{name}},\n\nUm lembrete de que ainda há {{dueAmount}} em dívida para a turma {{batch}}. Por favor conclua o pagamento para manter a sua inscrição ativa.\n\nObrigado,\nNovo Horizonte",
    bn: "হ্যালো {{name}},\n\n{{batch}} ব্যাচের জন্য {{dueAmount}} এখনও বাকি আছে। আপনার নিবন্ধন সক্রিয় রাখতে অনুগ্রহ করে পেমেন্ট সম্পূর্ণ করুন।\n\nধন্যবাদ,\nNovo Horizonte",
    ur: "ہیلو {{name}}،\n\n{{batch}} بیچ کے لیے ابھی بھی {{dueAmount}} باقی ہے۔ اپنے اندراج کو فعال رکھنے کے لیے براہ کرم ادائیگی مکمل کریں۔\n\nشکریہ،\nNovo Horizonte",
    hi: "नमस्ते {{name}},\n\n{{batch}} बैच के लिए अभी भी {{dueAmount}} बकाया है। अपना नामांकन सक्रिय रखने के लिए कृपया भुगतान पूरा करें।\n\nधन्यवाद,\nNovo Horizonte",
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
  return interpolate(body, vars);
}

export function renderEmailSubject(
  key: TemplateKey,
  locale: Locale,
  vars: TemplateVars,
): string {
  const subject = EMAIL_SUBJECTS[key][locale] ?? EMAIL_SUBJECTS[key].en;
  return interpolate(subject, vars);
}

export function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, name: keyof TemplateVars) => {
    const v = vars[name];
    return v == null ? `{{${String(name)}}}` : String(v);
  });
}

/** Build a https://wa.me/<number>?text=… link. Phone may include +, spaces, dashes. */
export function buildWaMeLink(phone: string, body: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}
