const COPY: Record<string, string> = {
  "Someone brands can't fool":
    "{name}, Buffi was built for you. You're done being misled by marketing language and vague labels. From here on, you'll know exactly what's in what you're buying — and whether it's worth a single dollar of what they're charging.",
  "Someone who buys less but better":
    "{name}, that's exactly what Buffi helps you do. Instead of guessing what's quality and what isn't, you'll have the data to choose fewer, smarter pieces — and stop wasting money on things that don't deliver.",
  "Someone who actually knows what they're paying for":
    "{name}, most people never find out. You're about to. Buffi breaks down what your clothes actually cost to make, what you're really paying for, and whether the math adds up.",
  "All three — I'm done settling":
    "{name}, then Buffi is exactly where you should be. You're about to shop with more intelligence than most people ever will — knowing what's in it, what it cost to make, and whether it's actually worth it."
};

export function getReflectionCopy(shopperType: string, name: string): string {
  const template = COPY[shopperType] ?? COPY["All three — I'm done settling"];
  const displayName = name.trim() || "You";
  return template.replace("{name}", displayName);
}
