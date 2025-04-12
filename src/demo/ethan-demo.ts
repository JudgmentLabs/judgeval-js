import { Tracer } from "../common/tracer";

const tracer = Tracer.getInstance({ projectName: "ethan-judgeval-js-testing" });

const say = tracer.observe({ name: "say", spanType: "tool" })((what: string) => {
  console.log(`Ethan says, "${what}!"`);
  return `Ethan said, "${what}!"`;
});

const input = "Hello, World!";
const output = say(input);
console.log(output);

/**
 * JS equivalent of:
 * with tracer.trace("myTool") as trace:
 *   print(trace)
 * 
 * Functions exactly the same. You can yield or return stuff inside it and it will
 * really yield/return! (versus callbacks, which require a little extra)
 */
for (const trace of tracer.trace("say")) {
  console.log(trace);
}
