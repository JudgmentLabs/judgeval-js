const AsyncGeneratorFunction = async function* () {
  /* empty */
}.constructor;
const GeneratorFunction = function* () {
  /* empty */
}.constructor;

export function isAsyncGeneratorFunction(
  fn: unknown,
): fn is (...args: unknown[]) => AsyncGenerator {
  return fn instanceof AsyncGeneratorFunction;
}

export function isGeneratorFunction(
  fn: unknown,
): fn is (...args: unknown[]) => Generator {
  return fn instanceof GeneratorFunction;
}
