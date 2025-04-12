import { Tracer } from "../common/tracer";

const tracer = Tracer.getInstance({ projectName: "ethan-judgeval-js-testing" });

const print = tracer.observe({ name: "print", spanType: "tool" })((what: any) => {
  console.log(what);
  return what;
});

const say = tracer.observe({ name: "say", spanType: "tool" })((what: string) => {
  return print(`Ethan says, "${what}!"`);
});

const input = "Hello, World";
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
// for (const trace of tracer.trace("say")) {
//   console.log(trace);
// }
