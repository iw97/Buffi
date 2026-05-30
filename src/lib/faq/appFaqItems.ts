export type FaqItem = { q: string; a: string };

/** In-app FAQ (profile → FAQ). */
export const APP_FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is Buffi's mission?",
    a: "Buffi focuses on two things: value and transparency. We believe in the informed consumer, and we're using material intelligence to show you exactly what you're paying for and whether it aligns with your values."
  },
  {
    q: "How do I use Buffi?",
    a: "Just scan your product's tag if you have it in front of you, or if you're an online shopper, paste the URL. You'll receive a breakdown of the materials in plain English, and our verdict on whether you're paying for the item's true value."
  },
  {
    q: "Can I get a refund?",
    a: "Yes! Please email us at heybuffi@gmail.com within 7 days of your billing date, and we'll take care of you."
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes! You may cancel your subscription at any time. Your app access will end at the end of your current billing period, so you will still be able to use Buffi until then."
  },
  {
    q: "I have another question.",
    a: "We'd love to hear from you. Send us an email at heybuffi@gmail.com and we'll get back to you as soon as we can."
  }
];
