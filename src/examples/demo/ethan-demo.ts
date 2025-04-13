import { Tracer } from "../../common/tracer";

const tracer = Tracer.getInstance({ projectName: "ethan-judgeval-js-testing" });

const print = tracer.observe({ name: "print", spanType: "tool" })(async (what: any) => {
  console.log(what);
  return what;
});

const say = tracer.observe({ name: "say", spanType: "tool" })(async (what: string) => {
  await print(`Ethan says, "${what}!"`);
  return await print(`Ethan said, "${what}!"`);
});

(async () => {
  const input = "Hello, World";
  const output = await say(input);
  console.log(output);
})();

/**
 * JS equivalent of:
 * with tracer.trace("say") as trace:
 *   print(trace)
 * 
 * Functions almost exactly the same. You can yield or return stuff inside it and it will
 * really yield/return! (versus callbacks, which require a little extra)
 * 
 * The only downside is that returning within the block returns before the trace is
 * completed, but this may or may not be intended behavior anyway
 */
// for (const trace of tracer.trace("say")) {
//   console.log(trace);
// }
