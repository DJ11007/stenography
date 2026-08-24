declare module "@anthro-ai/krutidev-unicode" {
  export default function convert(text: string): string;
}

declare module "@anthro-ai/krutidev-unicode/dictionary/main.js" {
  const mapping: Array<[string, string]>;
  export default mapping;
}
