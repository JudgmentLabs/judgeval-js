import { Tracer } from "judgeval";

class TravelAgent {
  @Tracer.observe({ spanType: "tool" })
  searchFlights(destination: string): string[] {
    return [`Morning flight to ${destination}`, `Evening flight to ${destination}`];
  }

  @Tracer.observe({ spanType: "tool" })
  searchHotels(destination: string): string {
    return `Central hotel in ${destination}`;
  }

  @Tracer.observe({ spanType: "agent" })
  plan(destination: string) {
    const flights = this.searchFlights(destination);
    const hotel = this.searchHotels(destination);
    return { flight: flights[0], hotel };
  }
}

async function main() {
  await Tracer.init({ projectName: "basic-decorator" });

  const agent = new TravelAgent();
  const trip = agent.plan("Paris");
  console.log(trip);

  await Tracer.forceFlush();
  await Tracer.shutdown();
}

main().catch(console.error);
